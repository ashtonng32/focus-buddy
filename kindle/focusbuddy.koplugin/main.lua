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
local POLL_SECONDS = 60 -- how often the screen re-syncs with the server (and updates the minutes)
local FULL_REFRESH_EVERY = 10 -- partial redraws between full (flashing) ones, to clear ghosting
local TASKS_PER_PAGE = 4

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
    self.pick = nil -- choosing a task: { kind, mode, fromSessionId, tasks, page }
    self.error = nil
    self.busy = false
    self.redraws = 0
    self.tick = function() self:sync() end
    self[1] = self:frame(self:message("Focus Buddy", "Connecting…"))
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
            self:smallButton("Close", function() self:close() end),
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
    local full = view_name ~= self.view_name or self.redraws >= FULL_REFRESH_EVERY
    if full then self.redraws = 0 end
    self.view_name = view_name
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
    self:schedule(POLL_SECONDS)
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
    if self.pick and (session or (self.pick.fromSessionId and not val(state.lastEnded) and not val(state.resume))) then
        self.pick = nil
    end
    self:render()
    -- Next sync: every minute, or right when the timer runs out.
    local wait = POLL_SECONDS
    if session then
        local left = (session.endsAt - (nowMs() + self.offset)) / 1000
        if left > 0 then wait = math.max(5, math.min(POLL_SECONDS, math.ceil(left) + 1)) end
    end
    self:schedule(wait)
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
        -- Back from a break: the task you were stuck on goes first.
        local resume = kind == "focus" and self.state and val(self.state.resume)
        if resume and val(resume.notionTaskId) then
            for i = #tasks, 1, -1 do
                if tasks[i].id == resume.notionTaskId then table.remove(tasks, i) end
            end
            table.insert(tasks, 1, {
                id = resume.notionTaskId,
                title = "Back to: " .. (val(resume.taskTitle) or "your task"),
                resumeId = resume.id,
            })
        end
        self.pick = { kind = kind, mode = mode, fromSessionId = fromSessionId, tasks = tasks, page = 1 }
        self:render()
    end)
end

function BuddyView:start(kind, mode, taskId, fromSessionId)
    self.pick = nil
    self:post("/api/session", { kind = kind, mode = mode, taskId = taskId, fromSessionId = fromSessionId })
end

-- Starts a task picked from the list. Picking something other than "Back to: ..." clears that reminder.
function BuddyView:startTask(pick, task)
    local resume = self.state and val(self.state.resume)
    if pick.kind == "focus" and resume and not task.resumeId then
        api("POST", "/api/resolve", { sessionId = resume.id, action = "handled" })
    end
    self:start(pick.kind, pick.mode, task.id, task.resumeId or pick.fromSessionId)
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

    -- Choosing a task ---------------------------------------------------------------------
    if self.pick then
        local pick = self.pick
        local mins = val(pick.kind == "switch" and settings.switch or settings[pick.mode])
        local header = pick.kind == "switch" and "Pick something else" or "Pick a task"
        local sub = mins and (mins .. " min timer") or nil
        local rows = VerticalGroup:new{ align = "center" }
        local first = (pick.page - 1) * TASKS_PER_PAGE + 1
        local row_h = Screen:scaleBySize(62)
        if #pick.tasks == 0 then
            table.insert(rows, self:tileRow({ { lines = { { text = "No tasks for today. Just start", size = 24, bold = true } },
                dark = true, callback = function() self:start(pick.kind, pick.mode, nil, pick.fromSessionId) end } }, row_h))
        end
        for i = first, math.min(#pick.tasks, first + TASKS_PER_PAGE - 1) do
            local t = pick.tasks[i]
            if i > first then table.insert(rows, VerticalSpan:new{ width = Screen:scaleBySize(8) }) end
            table.insert(rows, self:tileRow({ { lines = { { text = t.title, size = 22, bold = true } },
                callback = function() self:startTask(pick, t) end } }, row_h))
        end
        local nav = {}
        table.insert(nav, { lines = { { text = "Back", size = 20 } }, callback = function()
            -- From "Something else", Back returns to the stuck question; otherwise to the feelings.
            self.pick = nil
            self:render()
        end })
        if #pick.tasks > TASKS_PER_PAGE then
            table.insert(nav, { lines = { { text = "More tasks", size = 20 } }, callback = function()
                pick.page = pick.page % math.ceil(#pick.tasks / TASKS_PER_PAGE) + 1
                self:render()
            end })
        end
        return self:show("tasks", self:column(
            self:message(header, sub),
            rows,
            self:tileRow(nav, Screen:scaleBySize(50))
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

    -- Start: How are you feeling? (a task you were stuck on shows first in the task list) -----
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

function FocusBuddy:init()
    self.ui.menu:registerToMainMenu(self)
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
