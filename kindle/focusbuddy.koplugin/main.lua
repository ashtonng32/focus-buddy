--[[
Focus Buddy for Kindle (KOReader plugin).

A landscape desk screen for the Focus Buddy app: How are you feeling? -> Pick a task -> Timer,
with "I'm stuck" -> Take a break / Something else. Everything lives on the Focus Buddy server
(the same data as the phone), so the phone and the Kindle stay in sync. The Kindle signs in
once with a PIN and keeps the token it gets back.

Open it from KOReader's top menu: Tools -> Focus Buddy.
]]

local Blitbuffer = require("ffi/blitbuffer")
local CenterContainer = require("ui/widget/container/centercontainer")
local Device = require("device")
local Event = require("ui/event")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local InfoMessage = require("ui/widget/infomessage")
local InputContainer = require("ui/widget/container/inputcontainer")
local InputDialog = require("ui/widget/inputdialog")
local JSON = require("json")
local LeftContainer = require("ui/widget/container/leftcontainer")
local OverlapGroup = require("ui/widget/overlapgroup")
local PluginShare = require("pluginshare")
local RightContainer = require("ui/widget/container/rightcontainer")
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local http = require("socket.http")
local logger = require("logger")
local ltn12 = require("ltn12")
local socket = require("socket")
local socketutil = require("socketutil")
local Screen = Device.screen

local DEFAULT_URL = "https://focus-buddy-lime.vercel.app"
local POLL_SECONDS = 5 -- re-sync this often, so starting or stopping on the phone shows up within ~5 s
local RETRY_SECONDS = 60 -- after an error (offline, server down), try again this often
local FULL_REFRESH_EVERY = 10 -- partial redraws between full (flashing) ones, to clear ghosting
local NO_TASK = { id = nil, title = "Up next", firstStep = "Just open it. That's the whole first step." }
local TAP_GUARD_SECONDS = 2 -- ignore taps this long after the screen changes (see Tile:onTapTile)
local AUTO_SLEEP_DEFAULT_HOUR = 18 -- auto sleep at 6 PM unless changed in Tools -> Focus Buddy -> Auto sleep
local SLEEP_CHECK_SECONDS = 13 -- if the Kindle still isn't asleep by then (all routes tried), put Keep alive back

-- When the screen last changed to a different page. Taps made while the Kindle was busy (waiting on the
-- network) are queued and only handled after the next screen is drawn, so a second tap on "Start" would
-- land on whatever replaced it, such as "I'm stuck". Taps just after a page change are dropped.
local guard_until = 0

local MODES = {
    { id = "low", label = "Low", hint = "Easy" },
    { id = "steady", label = "Motivated", hint = "Ready" },
    { id = "flow", label = "Flow", hint = "Locked-in" },
}

---------------------------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------------------------

-- KOReader's JSON.decode turns `null` into a function; treat that as nil.
local function val(x)
    if type(x) == "function" then return nil end
    return x
end

local function nowMs()
    return math.floor(socket.gettime() * 1000)
end

local function urlencode(s)
    return (tostring(s):gsub("[^%w%-_%.~]", function(c) return string.format("%%%02X", string.byte(c)) end))
end

local function setting(key) return G_reader_settings:readSetting(key) end

--- Calls the Focus Buddy API. Returns data, or nil plus an error ("offline", "unauthorized", or a message).
local function api(method, path, body)
    local url = (setting("focusbuddy_url") or DEFAULT_URL) .. path
    local headers = { ["Accept"] = "application/json" }
    local token = setting("focusbuddy_token")
    if token then headers["Authorization"] = "Bearer " .. token end
    local source
    if body then
        local payload = JSON.encode(body)
        headers["Content-Type"] = "application/json"
        headers["Content-Length"] = tostring(#payload)
        source = ltn12.source.string(payload)
    elseif method == "POST" then
        headers["Content-Length"] = "0"
    end
    local sink = {}
    socketutil:set_timeout(socketutil.LARGE_BLOCK_TIMEOUT, socketutil.LARGE_TOTAL_TIMEOUT)
    local ok, code, resp_headers = pcall(function()
        return socket.skip(1, http.request{
            url = url,
            method = method,
            headers = headers,
            source = source,
            sink = ltn12.sink.table(sink),
        })
    end)
    socketutil:reset_timeout()
    if not ok or resp_headers == nil then
        logger.warn("FocusBuddy: network error", method, path, code)
        return nil, "offline"
    end
    local data
    local content = table.concat(sink)
    if content ~= "" then
        local okj, decoded = pcall(JSON.decode, content)
        if okj and type(decoded) == "table" then data = decoded end
    end
    if code == 401 and path ~= "/api/kindle/login" then return nil, "unauthorized" end
    if type(code) ~= "number" or code >= 300 then
        return nil, (data and val(data.error)) or ("Server error " .. tostring(code))
    end
    return data or {}
end

---------------------------------------------------------------------------------------------
-- Tile: a big tappable box with one or more centered lines of text
---------------------------------------------------------------------------------------------

local Tile = InputContainer:extend{
    width = nil,
    height = nil,
    lines = nil, -- { { text = "...", size = 28, bold = true }, ... }
    callback = nil,
    dark = false, -- black tile with white text, for the main action
}

function Tile:init()
    local border = Size.border.thick
    local inner_w = self.width - 2 * border
    local fg = self.dark and Blitbuffer.COLOR_WHITE or Blitbuffer.COLOR_BLACK
    local group = VerticalGroup:new{ align = "center" }
    for i, line in ipairs(self.lines) do
        if i > 1 then table.insert(group, VerticalSpan:new{ width = Screen:scaleBySize(4) }) end
        table.insert(group, TextBoxWidget:new{
            text = line.text,
            face = Font:getFace("cfont", line.size or 24),
            bold = line.bold,
            fgcolor = fg,
            bgcolor = self.dark and Blitbuffer.COLOR_BLACK or nil,
            width = inner_w - 2 * Size.padding.large,
            alignment = "center",
        })
    end
    self.dimen = Geom:new{ x = 0, y = 0, w = self.width, h = self.height }
    self[1] = FrameContainer:new{
        bordersize = border,
        radius = Size.radius.window,
        padding = 0,
        margin = 0,
        background = self.dark and Blitbuffer.COLOR_BLACK or Blitbuffer.COLOR_WHITE,
        CenterContainer:new{
            dimen = Geom:new{ w = inner_w, h = self.height - 2 * border },
            group,
        },
    }
    self.ges_events = {
        TapTile = { GestureRange:new{ ges = "tap", range = function() return self.dimen end } },
    }
end

function Tile:onTapTile()
    if socket.gettime() < guard_until then return true end
    if self.callback then self.callback() end
    return true
end

---------------------------------------------------------------------------------------------
-- The full-screen Focus Buddy view
---------------------------------------------------------------------------------------------

local BuddyView = InputContainer:extend{
    covers_fullscreen = true,
    on_close = nil,
}

function BuddyView:init()
    self.W = Screen:getWidth()
    self.H = Screen:getHeight()
    self.dimen = Geom:new{ x = 0, y = 0, w = self.W, h = self.H }
    self.pad = Screen:scaleBySize(16)
    self.gap = Screen:scaleBySize(14)
    self.offset = 0 -- server clock minus Kindle clock, in ms
    self.state = nil
    self.pick = nil -- the suggested task before its timer starts: { kind, mode, fromSessionId, tasks, idx }
    self.sig = nil -- what the screen last showed from the server state; unchanged polls don't redraw
    self.error = nil
    self.busy = false
    self.redraws = 0
    self.restore_keepalive = false -- we turned Keep alive off to sleep; turn it back on when the Kindle wakes
    self.sleep_pending = false -- asked the Kindle to sleep, waiting for it to happen
    self.resumed_at = 0 -- when the Kindle last woke up (socket.gettime)
    self.was_before_sleep_time = self:beforeSleepTime()
    self.auto_sleep_due = false
    self.tick = function()
        if self:checkAutoSleep() then return end
        self:sync()
    end
    self[1] = self:frame(self:message("Focus Buddy", "Connecting…"))
end

-- Sleep ---------------------------------------------------------------------------------------
-- Keep alive (the KOReader plugin) stops the Kindle from sleeping, power button included. Sleep turns
-- it off just for this sleep and turns it back on when the Kindle wakes (the "Resume" event).

local function sleepHour()
    local h = setting("focusbuddy_sleep_hour")
    if h == nil then return AUTO_SLEEP_DEFAULT_HOUR end
    return h -- -1 means off
end

function BuddyView:beforeSleepTime()
    local h = sleepHour()
    return h < 0 or os.date("*t").hour < h
end

-- Auto sleep: once the clock passes the sleep time while Focus Buddy is open (not if it was opened after),
-- sleep as soon as no timer is running. Returns true if it put the Kindle to sleep.
function BuddyView:checkAutoSleep()
    local before = self:beforeSleepTime()
    if self.was_before_sleep_time and not before then self.auto_sleep_due = true end
    self.was_before_sleep_time = before
    if not self.auto_sleep_due then return false end
    local session = self.state and val(self.state.session)
    if session and session.kind ~= "break" then
        local _, over = self:minutesLeft(session.endsAt)
        if not over then return false end -- let the running timer finish first
    end
    self.auto_sleep_due = false
    self:sleepNow()
    return true
end

-- Runs a shell command and returns its output (trimmed).
local function sh(cmd)
    local f = io.popen(cmd .. " 2>&1")
    if not f then return "" end
    local out = f:read("*a") or ""
    f:close()
    return (out:gsub("%s+$", ""))
end

local function powerdProp(name)
    if not Device:isKindle() then return "" end
    return sh("lipc-get-prop com.lab126.powerd " .. name)
end

local function asleep()
    local state = powerdProp("state")
    return state == "screenSaver" or state == "suspended"
end

-- Ways to ask the Kindle to sleep, tried in order until it does (all simulate a power-button press).
local SLEEP_ROUTES = {
    { at = 1, name = "KOReader suspend", run = function() UIManager:suspend() end },
    { at = 5, name = "powerButton (lipc)", run = function() sh("lipc-set-prop -i com.lab126.powerd powerButton 1") end },
    { at = 9, name = "powerd_test -p", run = function() sh("powerd_test -p") end },
}

function BuddyView:sleepNow()
    if self.sleep_pending then return end
    logger.info("FocusBuddy sleep: start; keepalive", tostring(PluginShare.keepalive),
        "state", powerdProp("state"), "preventScreenSaver", powerdProp("preventScreenSaver"))
    if Device:isKindle() and (PluginShare.keepalive or powerdProp("preventScreenSaver") == "1") then
        local out = sh("lipc-set-prop -i com.lab126.powerd preventScreenSaver 0")
        logger.info("FocusBuddy sleep: keep alive off:", out, "-> preventScreenSaver", powerdProp("preventScreenSaver"))
        PluginShare.keepalive = false
        self.restore_keepalive = true
    end
    self.sleep_pending = true
    UIManager:unschedule(self.tick)
    local tried = {}
    for _, route in ipairs(SLEEP_ROUTES) do
        UIManager:scheduleIn(route.at, function()
            -- Stop once it's asleep, so a second "press" doesn't wake it straight back up.
            if not self.sleep_pending or asleep() then return end
            table.insert(tried, route.name)
            local ok, err = pcall(route.run)
            logger.info("FocusBuddy sleep: tried", route.name, ok and "" or tostring(err), "-> state", powerdProp("state"))
        end)
    end
    -- If the Kindle still didn't go to sleep, put Keep alive back and say what happened.
    UIManager:scheduleIn(SLEEP_CHECK_SECONDS, function()
        if not self.sleep_pending or asleep() then return end
        self.sleep_pending = false
        local prevent = powerdProp("preventScreenSaver")
        local state = powerdProp("state")
        self:restoreKeepalive()
        logger.warn("FocusBuddy sleep: failed; tried", table.concat(tried, ", "), "state", state, "preventScreenSaver", prevent)
        UIManager:show(InfoMessage:new{
            text = "The Kindle didn't go to sleep. Keep alive is back on.\n\nTried: " .. table.concat(tried, ", ")
                .. "\nPower state: " .. state .. " · preventScreenSaver was " .. prevent,
        })
        self:schedule(POLL_SECONDS)
    end)
end

function BuddyView:restoreKeepalive()
    if not self.restore_keepalive then return end
    sh("lipc-set-prop -i com.lab126.powerd preventScreenSaver 1")
    PluginShare.keepalive = true
    self.restore_keepalive = false
end

function BuddyView:onSuspend()
    self.sleep_pending = false
    UIManager:unschedule(self.tick)
end

function BuddyView:onResume()
    self:restoreKeepalive()
    self.resumed_at = socket.gettime()
    self.was_before_sleep_time = self:beforeSleepTime()
    -- Give Wi-Fi a moment to reconnect, then catch up with the phone.
    self:schedule(3)
end

function BuddyView:onShow()
    UIManager:setDirty(self, "full")
    UIManager:nextTick(function() self:sync() end)
end

function BuddyView:onCloseWidget()
    UIManager:unschedule(self.tick)
end

function BuddyView:close()
    UIManager:unschedule(self.tick)
    UIManager:close(self, "full")
    if self.on_close then self.on_close() end
end

-- Layout ------------------------------------------------------------------------------------

function BuddyView:text(text, size, bold, width)
    return TextBoxWidget:new{
        text = text,
        face = Font:getFace("cfont", size),
        bold = bold,
        width = width or (self.W - 2 * self.pad),
        alignment = "center",
    }
end

function BuddyView:smallButton(label, callback)
    return Tile:new{
        width = Screen:scaleBySize(110),
        height = Screen:scaleBySize(40),
        lines = { { text = label, size = 16 } },
        callback = callback,
    }
end

-- Wraps a body in the page: a slim top bar (title + Close) and the body centered below it.
function BuddyView:frame(body)
    local bar_h = Screen:scaleBySize(52)
    local bar_dimen = Geom:new{ w = self.W - 2 * self.pad, h = bar_h }
    local bar = OverlapGroup:new{
        dimen = bar_dimen,
        LeftContainer:new{
            dimen = bar_dimen,
            TextWidget:new{ text = "Focus Buddy", face = Font:getFace("cfont", 18), bold = true },
        },
        RightContainer:new{
            dimen = bar_dimen,
            HorizontalGroup:new{
                align = "center",
                self:smallButton("Sleep", function() self:sleepNow() end),
                HorizontalSpan:new{ width = self.gap },
                self:smallButton("Close", function() self:close() end),
            },
        },
    }
    return FrameContainer:new{
        bordersize = 0,
        padding = 0,
        margin = 0,
        background = Blitbuffer.COLOR_WHITE,
        VerticalGroup:new{
            align = "center",
            CenterContainer:new{ dimen = Geom:new{ w = self.W, h = bar_h }, bar },
            CenterContainer:new{ dimen = Geom:new{ w = self.W, h = self.H - bar_h }, body },
        },
    }
end

-- A row of equal tiles across the screen. items: { { lines = {...}, callback = fn, dark = bool }, ... }
function BuddyView:tileRow(items, height)
    local n = #items
    local w = math.floor((self.W - 2 * self.pad - (n - 1) * self.gap) / n)
    local row = HorizontalGroup:new{ align = "center" }
    for i, item in ipairs(items) do
        if i > 1 then table.insert(row, HorizontalSpan:new{ width = self.gap }) end
        table.insert(row, Tile:new{
            width = w,
            height = height,
            lines = item.lines,
            callback = item.callback,
            dark = item.dark,
        })
    end
    return row
end

function BuddyView:column(...)
    local group = VerticalGroup:new{ align = "center" }
    for i, w in ipairs({ ... }) do
        if i > 1 then table.insert(group, VerticalSpan:new{ width = self.gap }) end
        table.insert(group, w)
    end
    return group
end

function BuddyView:message(title, sub)
    if sub then
        return self:column(self:text(title, 34, true), self:text(sub, 22))
    end
    return self:text(title, 34, true)
end

function BuddyView:show(view_name, body)
    self[1] = self:frame(body)
    self.redraws = self.redraws + 1
    if view_name ~= self.view_name then guard_until = socket.gettime() + TAP_GUARD_SECONDS end
    local full = view_name ~= self.view_name or self.redraws >= FULL_REFRESH_EVERY
    if full then self.redraws = 0 end
    self.view_name = view_name
    if self.state then self.sig = self:signature() end
    UIManager:setDirty(self, full and "full" or "ui")
end

-- Server calls ------------------------------------------------------------------------------

-- Runs an API call; on failure shows an error (or the PIN screen) and returns nil.
function BuddyView:call(method, path, body)
    local data, err = api(method, path, body)
    if data then
        self.error = nil
        return data
    end
    if err == "unauthorized" then
        G_reader_settings:delSetting("focusbuddy_token")
        self:render()
        return nil
    end
    self.error = err == "offline" and "Can't reach Focus Buddy. Check the Wi-Fi." or err
    self:render()
    -- Just woke up: Wi-Fi is probably still reconnecting, so keep trying every few seconds for a minute.
    self:schedule(socket.gettime() - self.resumed_at < 60 and POLL_SECONDS or RETRY_SECONDS)
    return nil
end

function BuddyView:schedule(seconds)
    UIManager:unschedule(self.tick)
    UIManager:scheduleIn(seconds, self.tick)
end

-- Fetches the shared state (same as the phone) and redraws.
function BuddyView:sync()
    if not setting("focusbuddy_token") then return self:render() end
    local state = self:call("GET", "/api/state")
    if not state then return end
    self.state = state
    if val(state.serverNow) then self.offset = state.serverNow - nowMs() end
    local session = val(state.session)
    -- The phone started something (or finished it): drop a half-made task choice.
    local dropped = false
    if self.pick and (session or (self.pick.fromSessionId and not val(state.lastEnded) and not val(state.resume))) then
        self.pick = nil
        dropped = true
    end
    -- Only redraw when something on screen changed, so the frequent idle polls don't flash the e-ink.
    local sig = self:signature()
    local stale = self.view_name == nil or self.view_name == "loading" or self.view_name == "error" or self.view_name == "login"
    if dropped or stale or sig ~= self.sig then self:render() end
    -- Next sync in a few seconds (the minutes left update as part of it; unchanged polls don't redraw).
    self:schedule(POLL_SECONDS)
end

-- A short summary of the server state as the screen shows it (including the minutes left).
function BuddyView:signature()
    local s = self.state or {}
    local parts = {}
    local session = val(s.session)
    if session then
        local mins, over = self:minutesLeft(session.endsAt)
        table.insert(parts, "s:" .. tostring(session.id) .. ":" .. tostring(session.kind) .. ":" .. mins .. ":" .. tostring(over)
            .. ":" .. tostring(val(session.taskTitle)))
    end
    local last = val(s.lastEnded)
    if last then
        table.insert(parts, "l:" .. tostring(last.id) .. ":" .. tostring(last.status) .. ":" .. tostring(val(last.talking)))
    end
    local resume = val(s.resume)
    if resume then table.insert(parts, "r:" .. tostring(resume.id)) end
    local settings = val(s.settings) or {}
    for _, k in ipairs({ "low", "steady", "flow", "keepGoing", "switch" }) do
        table.insert(parts, tostring(val(settings[k])))
    end
    return table.concat(parts, "|")
end

-- Runs an action (one at a time), then re-syncs.
function BuddyView:act(fn)
    if self.busy then return end
    self.busy = true
    local ok, err = pcall(fn)
    self.busy = false
    if not ok then logger.err("FocusBuddy: action failed", err) end
end

function BuddyView:post(path, body)
    self:act(function()
        if self:call("POST", path, body) then self:sync() end
    end)
end

function BuddyView:openTasks(kind, mode, fromSessionId, exclude)
    self:act(function()
        local q = "/api/today?mode=" .. urlencode(mode)
        if exclude then q = q .. "&exclude=" .. urlencode(exclude) end
        local data = self:call("GET", q)
        if not data then return end
        local tasks = {}
        for _, t in ipairs(val(data.tasks) or {}) do
            table.insert(tasks, { id = val(t.id), title = val(t.title) or "Untitled", firstStep = val(t.firstStep) })
        end
        if #tasks == 0 then tasks = { NO_TASK } end
        self.pick = { kind = kind, mode = mode, fromSessionId = fromSessionId, tasks = tasks, idx = 1 }
        self:render()
    end)
end

-- "Choose a different task": move on to the next suggestion, like the phone's "Different task".
function BuddyView:nextTask()
    local pick = self.pick
    if not pick then return end
    local task = pick.tasks[pick.idx]
    if task and task.id then
        -- Same as the phone: note the skip. If the call fails, the swap still happens.
        pcall(api, "POST", "/api/skip", { taskId = task.id, title = task.title })
    end
    pick.idx = pick.idx % #pick.tasks + 1
    self:render()
end

function BuddyView:start(kind, mode, taskId, fromSessionId)
    self.pick = nil
    self:post("/api/session", { kind = kind, mode = mode, taskId = taskId, fromSessionId = fromSessionId })
end

function BuddyView:askPin()
    local dialog
    dialog = InputDialog:new{
        title = "Focus Buddy PIN",
        input_type = "number",
        text_type = "password",
        buttons = {
            {
                {
                    text = "Cancel",
                    id = "close",
                    callback = function() UIManager:close(dialog) end,
                },
                {
                    text = "Connect",
                    is_enter_default = true,
                    callback = function()
                        local pin = dialog:getInputText()
                        UIManager:close(dialog)
                        self:login(pin)
                    end,
                },
            },
        },
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function BuddyView:login(pin)
    local data, err = api("POST", "/api/kindle/login", { pin = pin })
    if data and val(data.token) then
        G_reader_settings:saveSetting("focusbuddy_token", data.token)
        G_reader_settings:flush()
        self.error = nil
        self:sync()
    else
        UIManager:show(InfoMessage:new{
            text = err == "offline" and "Can't reach Focus Buddy. Check the Wi-Fi." or (err or "Wrong PIN"),
        })
    end
end

-- Screens -----------------------------------------------------------------------------------

function BuddyView:minutesLeft(endsAt)
    local ms = endsAt - (nowMs() + self.offset)
    return math.max(0, math.ceil(ms / 60000)), ms <= 0
end

function BuddyView:feelingTiles(onPick)
    local settings = val(self.state and self.state.settings) or {}
    local items = {}
    for _, m in ipairs(MODES) do
        local minutes = val(settings[m.id])
        table.insert(items, {
            lines = {
                { text = m.label, size = 32, bold = true },
                { text = m.hint .. (minutes and (" · " .. minutes .. " min") or ""), size = 20 },
            },
            callback = function() onPick(m.id) end,
        })
    end
    return self:tileRow(items, Screen:scaleBySize(200))
end

function BuddyView:render()
    if not setting("focusbuddy_token") then
        return self:show("login", self:column(
            self:message("Connect this Kindle", "Enter your Focus Buddy PIN."),
            self:tileRow({ { lines = { { text = "Enter PIN", size = 26, bold = true } }, dark = true,
                callback = function() self:askPin() end } }, Screen:scaleBySize(90))
        ))
    end

    if self.error then
        return self:show("error", self:column(
            self:message("Hmm.", self.error),
            self:tileRow({ { lines = { { text = "Try again", size = 26, bold = true } },
                callback = function() self.error = nil; self:sync() end } }, Screen:scaleBySize(90))
        ))
    end

    local state = self.state
    if not state then
        return self:show("loading", self:message("Focus Buddy", "Connecting…"))
    end

    local session = val(state.session)
    local settings = val(state.settings) or {}

    -- A block is running ---------------------------------------------------------------
    if session then
        local mins, over = self:minutesLeft(session.endsAt)

        if session.kind == "break" then
            return self:show(over and "break_over" or "break", self:column(
                self:text(over and "Break's over." or "Take a break", 22),
                self:text(val(session.taskTitle) or "Step away for a bit.", 34, true),
                over and VerticalSpan:new{ width = 0 } or self:text(mins .. " min left", 26),
                self:tileRow({ { lines = { { text = "I'm back", size = 28, bold = true } }, dark = over,
                    callback = function() self:post("/api/checkin", { sessionId = session.id, action = "back" }) end } },
                    Screen:scaleBySize(90))
            ))
        end

        if over then
            local keep = val(settings.keepGoing)
            return self:show("checkin", self:column(
                self:message("Time's up.", val(session.taskTitle)),
                self:tileRow({
                    { lines = { { text = "Keep going", size = 28, bold = true },
                        { text = keep and ("+" .. keep .. " min") or "", size = 20 } }, dark = true,
                      callback = function() self:post("/api/checkin", { sessionId = session.id, action = "keep_going" }) end },
                    { lines = { { text = "Done", size = 28, bold = true } },
                      callback = function() self:post("/api/checkin", { sessionId = session.id, action = "done" }) end },
                    { lines = { { text = "I'm stuck", size = 28, bold = true } },
                      callback = function() self:post("/api/checkin", { sessionId = session.id, action = "stuck" }) end },
                }, Screen:scaleBySize(150))
            ))
        end

        -- Timer: the task on the left, the minutes on the right, "I'm stuck" along the bottom.
        local left_w = math.floor((self.W - 2 * self.pad) * 0.62)
        local right_w = self.W - 2 * self.pad - left_w - self.gap
        local task_col = VerticalGroup:new{
            align = "left",
            TextBoxWidget:new{
                text = session.kind == "switch" and "Something else for a bit" or "Working on",
                face = Font:getFace("cfont", 18), width = left_w,
            },
            VerticalSpan:new{ width = Screen:scaleBySize(6) },
            TextBoxWidget:new{
                text = val(session.taskTitle) or "Up next",
                face = Font:getFace("cfont", 32), bold = true, width = left_w,
            },
            VerticalSpan:new{ width = Screen:scaleBySize(12) },
            TextBoxWidget:new{
                text = val(session.firstStep) or "",
                face = Font:getFace("cfont", 20), width = left_w,
            },
        }
        local time_col = VerticalGroup:new{
            align = "center",
            self:text(tostring(mins), 96, true, right_w),
            self:text(mins == 1 and "min left" or "mins left", 22, false, right_w),
        }
        local top = HorizontalGroup:new{
            align = "center",
            task_col,
            HorizontalSpan:new{ width = self.gap },
            time_col,
        }
        return self:show("timer", self:column(
            top,
            VerticalSpan:new{ width = Screen:scaleBySize(16) },
            self:tileRow({ { lines = { { text = "I'm stuck", size = 26, bold = true } },
                callback = function() self:post("/api/checkin", { sessionId = session.id, action = "stuck" }) end } },
                Screen:scaleBySize(80))
        ))
    end

    -- The suggested task, before its timer starts: Start, or choose a different one ----------
    if self.pick then
        local pick = self.pick
        local task = pick.tasks[pick.idx] or NO_TASK
        local mins = val(pick.kind == "switch" and settings.switch or settings[pick.mode])
        local actions = {
            { lines = { { text = mins and ("Start · " .. mins .. " min") or "Start", size = 30, bold = true } }, dark = true,
              callback = function() self:start(pick.kind, pick.mode, task.id, pick.fromSessionId) end },
        }
        if #pick.tasks > 1 then
            table.insert(actions, { lines = { { text = "Choose a different task", size = 26, bold = true } },
                callback = function() self:nextTask() end })
        end
        local first_step = val(task.firstStep)
        return self:show("task", self:column(
            self:text(pick.kind == "switch" and "Your other task will be waiting." or "Up next", 22),
            self:text(task.title, 52, true),
            first_step and self:text("First step: " .. first_step, 24) or VerticalSpan:new{ width = 0 },
            VerticalSpan:new{ width = Screen:scaleBySize(8) },
            self:tileRow(actions, Screen:scaleBySize(110)),
            -- From "Something else", Back returns to the stuck question; otherwise to the feelings.
            self:tileRow({ { lines = { { text = "Back", size = 20 } },
                callback = function() self.pick = nil; self:render() end } }, Screen:scaleBySize(50))
        ))
    end

    -- A finished block waiting on its follow-up ---------------------------------------------
    local last = val(state.lastEnded)
    if last then
        local mode = val(last.mode) or "steady"
        if last.status == "done" then
            return self:show("done", self:column(
                self:message("Nice work.", val(last.taskTitle)),
                self:tileRow({
                    { lines = { { text = "Next task", size = 28, bold = true } }, dark = true,
                      callback = function() self:post("/api/resolve", { sessionId = last.id, action = "handled" }) end },
                    { lines = { { text = "Take a break", size = 28, bold = true } },
                      callback = function() self:start("break", mode, nil, last.id) end },
                }, Screen:scaleBySize(150))
            ))
        end
        if val(last.talking) then
            return self:show("talking", self:column(
                self:message("Talking it through on your phone.", "Tap \"I'm back\" in the phone app when you're done."),
                self:tileRow({ { lines = { { text = "Refresh", size = 24, bold = true } },
                    callback = function() self:sync() end } }, Screen:scaleBySize(70))
            ))
        end
        -- Stuck: only the two options; "Talk it through" stays on the phone.
        return self:show("stuck", self:column(
            self:message("What do you need?", val(last.taskTitle)),
            self:tileRow({
                { lines = { { text = "Take a break", size = 30, bold = true },
                    { text = "Step away for a few minutes", size = 18 } },
                  callback = function() self:start("break", mode, nil, last.id) end },
                { lines = { { text = "Work on something else", size = 30, bold = true },
                    { text = "This one will be here when you come back", size = 18 } },
                  callback = function() self:openTasks("switch", mode, last.id, val(last.notionTaskId)) end },
            }, Screen:scaleBySize(200))
        ))
    end

    -- Back from a break: return to the task you were stuck on -------------------------------
    local resume = val(state.resume)
    if resume then
        return self:show("resume", self:column(
            self:message("Back to it?", val(resume.taskTitle)),
            self:feelingTiles(function(mode) self:start("focus", mode, resume.notionTaskId, resume.id) end),
            self:tileRow({ { lines = { { text = "Something else", size = 20 } },
                callback = function() self:post("/api/resolve", { sessionId = resume.id, action = "handled" }) end } },
                Screen:scaleBySize(50))
        ))
    end

    -- Start: How are you feeling? ------------------------------------------------------------
    return self:show("feeling", self:column(
        self:text("How are you feeling?", 34, true),
        VerticalSpan:new{ width = Screen:scaleBySize(8) },
        self:feelingTiles(function(mode) self:openTasks("focus", mode) end)
    ))
end

---------------------------------------------------------------------------------------------
-- Plugin entry: Tools -> Focus Buddy
---------------------------------------------------------------------------------------------

local FocusBuddy = WidgetContainer:extend{
    name = "focusbuddy",
    is_doc_only = false,
}

local function autostartOn()
    return G_reader_settings:nilOrTrue("focusbuddy_autostart")
end

function FocusBuddy:init()
    self.ui.menu:registerToMainMenu(self)
    -- Open Focus Buddy when KOReader starts. Plugins are set up again each time a book or the file browser
    -- opens, so PluginShare (kept for the whole KOReader run) makes sure this happens only once per start.
    if autostartOn() and not PluginShare.focusbuddy_autostarted then
        PluginShare.focusbuddy_autostarted = true
        UIManager:scheduleIn(0.5, function() self:open() end)
    end
end

local function hourLabel(h)
    if h < 0 then return "Off" end
    local h12 = h % 12
    if h12 == 0 then h12 = 12 end
    return h12 .. (h < 12 and " AM" or " PM")
end

-- Tools -> Focus Buddy -> Auto sleep: Off, or a time in the evening (default 6 PM).
local function autoSleepMenu()
    local items = {}
    for _, h in ipairs({ -1, 17, 18, 19, 20, 21, 22 }) do
        table.insert(items, {
            text = hourLabel(h),
            radio = true,
            checked_func = function() return sleepHour() == h end,
            callback = function()
                G_reader_settings:saveSetting("focusbuddy_sleep_hour", h)
                G_reader_settings:flush()
            end,
        })
    end
    return items
end

function FocusBuddy:addToMainMenu(menu_items)
    menu_items.focus_buddy = {
        text = "Focus Buddy",
        sorting_hint = "tools",
        sub_item_table = {
            {
                text = "Open Focus Buddy",
                callback = function() self:open() end,
            },
            {
                text = "Open when KOReader starts",
                checked_func = autostartOn,
                callback = function()
                    G_reader_settings:saveSetting("focusbuddy_autostart", not autostartOn())
                    G_reader_settings:flush()
                end,
            },
            {
                text_func = function() return "Auto sleep: " .. hourLabel(sleepHour()) end,
                sub_item_table_func = autoSleepMenu,
            },
            {
                text = "Sign out this Kindle",
                keep_menu_open = true,
                callback = function()
                    G_reader_settings:delSetting("focusbuddy_token")
                    G_reader_settings:flush()
                    UIManager:show(InfoMessage:new{ text = "Signed out. You'll be asked for the PIN next time.", timeout = 3 })
                end,
            },
        },
    }
end

function FocusBuddy:setRotation(mode)
    pcall(function() self.ui:handleEvent(Event:new("SetRotationMode", mode)) end)
end

function FocusBuddy:open()
    -- Landscape while Focus Buddy is open; put the screen back the way it was on Close.
    local previous = Screen:getRotationMode()
    if Screen:getWidth() < Screen:getHeight() then
        self:setRotation(Screen.DEVICE_ROTATED_CLOCKWISE)
    end
    UIManager:show(BuddyView:new{
        on_close = function()
            if Screen:getRotationMode() ~= previous then self:setRotation(previous) end
        end,
    })
end

return FocusBuddy
