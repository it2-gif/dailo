const STORAGE_KEY = "dailo-state-v1";
const dateKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const todayKey = () => dateKey();
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const initialState = {
  tasks: [],
  history: [],
  settings: { initials: "DL", reviewTime: "21:00", theme: "light" }
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.tasks) ? { ...initialState, ...saved, settings: { ...initialState.settings, ...saved.settings } } : structuredClone(initialState);
  } catch { return structuredClone(initialState); }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function taskProgress(task) {
  if (task.done) return 100;
  if (task.type === "percent") return Number(task.progress) || 0;
  if (task.type === "counter") return Math.min(100, Math.round(((task.progress || 0) / task.goal) * 100));
  return 0;
}

function todayTasks() { return state.tasks.filter(task => task.date === todayKey()); }

function render() {
  document.body.classList.toggle("dark", state.settings.theme === "dark");
  document.querySelector('meta[name="theme-color"]').content = state.settings.theme === "dark" ? "#050911" : "#0b1220";
  document.querySelector(".avatar").textContent = state.settings.initials || "DL";
  document.querySelector("#initials-input").value = state.settings.initials || "DL";
  document.querySelector("#review-time").value = state.settings.reviewTime || "21:00";
  renderToday(); renderHistory(); renderInsights();
}

function renderToday() {
  const tasks = todayTasks();
  const average = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length) : 0;
  const complete = tasks.filter(task => taskProgress(task) === 100).length;
  const date = new Date();
  document.querySelector("#today-label").textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  document.querySelector("#progress-ring").style.setProperty("--progress", average);
  document.querySelector("#progress-percent").textContent = `${average}%`;
  document.querySelector("#progress-detail").textContent = `${complete} of ${tasks.length} tasks complete`;
  document.querySelector("#task-count").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  document.querySelector("#progress-message").textContent = average === 100 && tasks.length ? "Today is complete." : average >= 70 ? "You’re closing in." : average > 0 ? "Momentum is building." : "A clear day starts here.";
  const list = document.querySelector("#task-list");
  list.innerHTML = tasks.map(taskCard).join("");
  document.querySelector("#empty-state").classList.toggle("hidden", tasks.length > 0);
}

function taskCard(task) {
  const progress = taskProgress(task);
  const meta = [task.priority === "high" ? '<span class="priority-high">High priority</span>' : "", task.time ? `<span>${formatTime(task.time)}</span>` : "", task.notes ? `<span>${escapeHtml(task.notes)}</span>` : ""].filter(Boolean).join("<span>·</span>");
  let control = "";
  if (task.type === "percent" && !task.done) control = `<div class="task-progress"><input aria-label="${escapeHtml(task.title)} progress" type="range" min="0" max="100" step="5" value="${task.progress || 0}" data-range="${task.id}"><strong>${progress}%</strong></div>`;
  if (task.type === "counter" && !task.done) control = `<div class="task-progress counter-controls"><button data-counter="${task.id}" data-delta="-1" aria-label="Decrease">−</button><strong>${task.progress || 0} / ${task.goal}</strong><button data-counter="${task.id}" data-delta="1" aria-label="Increase">＋</button></div>`;
  return `<article class="task-card ${task.done ? "complete" : ""}"><div class="task-main"><button class="complete-button" data-complete="${task.id}" aria-label="Toggle ${escapeHtml(task.title)}">${task.done ? "✓" : ""}</button><div class="task-copy"><span class="task-title">${escapeHtml(task.title)}</span><div class="task-meta">${meta}</div></div><button class="task-menu" data-edit="${task.id}" aria-label="Edit ${escapeHtml(task.title)}">···</button></div>${control}</article>`;
}

function renderHistory() {
  const list = document.querySelector("#history-list");
  if (!state.history.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">◷</div><h3>No closed days yet</h3><p>Your completed reviews will appear here.</p></div>'; return; }
  list.innerHTML = [...state.history].reverse().map(day => `<article class="history-card"><div><strong>${formatDate(day.date)}</strong><p>${day.completed} of ${day.total} completed${day.reflection ? ` · ${escapeHtml(day.reflection)}` : ""}</p></div><span class="history-score">${day.score}%</span></article>`).join("");
}

function renderInsights() {
  const last = state.history.slice(-7);
  const rate = last.length ? Math.round(last.reduce((sum, day) => sum + day.score, 0) / last.length) : 0;
  let streak = 0;
  for (const day of [...state.history].reverse()) { if (day.score >= 70) streak++; else break; }
  document.querySelector("#completion-rate").textContent = `${rate}%`;
  document.querySelector("#current-streak").textContent = streak;
  const data = last.length ? last : Array.from({ length: 7 }, (_, index) => ({ date: new Date(Date.now() - (6-index)*86400000).toISOString().slice(0,10), score: 0 }));
  document.querySelector("#week-chart").innerHTML = data.map(day => `<div class="bar-wrap"><span>${day.score}%</span><div class="bar" style="height:${Math.max(4, day.score)}%"></div><small>${new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined,{weekday:"narrow"})}</small></div>`).join("");
}

function navigate(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `${view}-view`));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  document.querySelector(".fab").classList.toggle("hidden", view !== "today");
  if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTask(task = null) {
  document.querySelector("#task-form").reset();
  document.querySelector("#editing-id").value = task?.id || "";
  document.querySelector("#task-title").value = task?.title || "";
  document.querySelector("#task-notes").value = task?.notes || "";
  document.querySelector("#task-priority").value = task?.priority || "normal";
  document.querySelector("#task-time").value = task?.time || "";
  const type = task?.type || "check";
  document.querySelector(`input[name="progress-type"][value="${type}"]`).checked = true;
  document.querySelector("#counter-goal").value = task?.goal || 10;
  document.querySelector("#counter-goal-field").classList.toggle("hidden", type !== "counter");
  document.querySelector("#delete-task").classList.toggle("hidden", !task);
  document.querySelector("#task-dialog").showModal();
  setTimeout(() => document.querySelector("#task-title").focus(), 100);
}

function submitTask(event) {
  event.preventDefault();
  const id = document.querySelector("#editing-id").value;
  const type = document.querySelector('input[name="progress-type"]:checked').value;
  const current = state.tasks.find(task => task.id === id);
  const task = {
    id: id || uid(), date: current?.date || todayKey(), title: document.querySelector("#task-title").value.trim(), notes: document.querySelector("#task-notes").value.trim(),
    priority: document.querySelector("#task-priority").value, time: document.querySelector("#task-time").value, type, goal: type === "counter" ? Number(document.querySelector("#counter-goal").value) : null,
    progress: current?.type === type ? current.progress : 0, done: current?.done || false, createdAt: current?.createdAt || Date.now()
  };
  if (!task.title) return;
  if (id) state.tasks = state.tasks.map(item => item.id === id ? task : item); else state.tasks.push(task);
  document.querySelector("#task-dialog").close(); saveState(); toast(id ? "Task updated" : "Task added");
}

function updateTask(id, changes) { state.tasks = state.tasks.map(task => task.id === id ? { ...task, ...changes } : task); saveState(); }

function openReview() {
  const tasks = todayTasks();
  if (!tasks.length) return toast("Add a task before closing the day");
  const complete = tasks.filter(task => taskProgress(task) === 100).length;
  const average = Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length);
  document.querySelector("#review-summary").innerHTML = `<strong>${average}%</strong><p>${complete} completed · ${tasks.length-complete} still open</p>`;
  document.querySelector("#review-tasks").innerHTML = tasks.filter(task => taskProgress(task) < 100).map(task => `<div class="review-row"><span>${escapeHtml(task.title)}</span><button data-tomorrow="${task.id}">Move to tomorrow</button></div>`).join("") || '<p class="muted">Everything is complete. Nicely done.</p>';
  const dialog = document.querySelector("#review-dialog");
  if (!dialog.open) dialog.showModal();
}

function closeDay() {
  const tasks = todayTasks();
  const score = Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length);
  const record = { date: todayKey(), total: tasks.length, completed: tasks.filter(task => taskProgress(task) === 100).length, score, reflection: document.querySelector("#day-reflection").value.trim() };
  state.history = [...state.history.filter(day => day.date !== record.date), record];
  document.querySelector("#day-reflection").value = "";
  document.querySelector("#review-dialog").close(); saveState(); toast("Today has been closed");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `dailo-backup-${todayKey()}.json`; link.click(); URL.revokeObjectURL(link.href); toast("Backup downloaded");
}

async function importData(file) {
  try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.tasks) || !Array.isArray(data.history)) throw new Error(); state = { ...initialState, ...data, settings: { ...initialState.settings, ...data.settings } }; saveState(); toast("Backup restored"); }
  catch { toast("That backup could not be read"); }
}

function toast(message) { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200); }
function formatTime(value) { const [h,m] = value.split(":"); return new Date(2000,0,1,h,m).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); }
function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{weekday:"long", month:"long", day:"numeric"}); }
function escapeHtml(value = "") { return value.replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }

document.addEventListener("click", event => {
  const target = event.target.closest("button, a, [data-view]"); if (!target) return;
  if (target.matches("[data-open-task]")) openTask();
  if (target.matches("[data-close-dialog]")) document.querySelector("#task-dialog").close();
  if (target.matches("[data-close-review]")) document.querySelector("#review-dialog").close();
  if (target.dataset.view) navigate(target.dataset.view);
  if (target.id === "open-settings") navigate("settings");
  if (target.id === "review-button") openReview();
  if (target.id === "close-day-button") closeDay();
  if (target.id === "theme-toggle") { state.settings.theme = state.settings.theme === "dark" ? "light" : "dark"; saveState(); }
  if (target.dataset.complete) { const task = state.tasks.find(item => item.id === target.dataset.complete); updateTask(task.id, { done: !task.done, progress: !task.done ? (task.type === "counter" ? task.goal : 100) : 0 }); }
  if (target.dataset.edit) openTask(state.tasks.find(task => task.id === target.dataset.edit));
  if (target.dataset.counter) { const task = state.tasks.find(item => item.id === target.dataset.counter); const progress = Math.max(0, Math.min(task.goal, (task.progress || 0) + Number(target.dataset.delta))); updateTask(task.id, { progress, done: progress >= task.goal }); }
  if (target.dataset.tomorrow) { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); updateTask(target.dataset.tomorrow, { date: dateKey(tomorrow) }); openReview(); }
  if (target.id === "export-data") exportData();
  if (target.id === "delete-task") { const id = document.querySelector("#editing-id").value; state.tasks = state.tasks.filter(task => task.id !== id); document.querySelector("#task-dialog").close(); saveState(); toast("Task deleted"); }
  if (target.id === "clear-data" && confirm("Erase every task, review, and setting from this device?")) { state = structuredClone(initialState); saveState(); toast("Dailo data erased"); }
});

document.addEventListener("change", event => {
  if (event.target.matches("[data-range]")) updateTask(event.target.dataset.range, { progress: Number(event.target.value), done: Number(event.target.value) === 100 });
});
document.querySelector("#task-form").addEventListener("submit", submitTask);
document.querySelectorAll('input[name="progress-type"]').forEach(input => input.addEventListener("change", () => document.querySelector("#counter-goal-field").classList.toggle("hidden", input.value !== "counter" || !input.checked)));
document.querySelector("#initials-input").addEventListener("change", event => { state.settings.initials = event.target.value.trim().toUpperCase() || "DL"; saveState(); });
document.querySelector("#review-time").addEventListener("change", event => { state.settings.reviewTime = event.target.value; saveState(); });
document.querySelector("#import-data").addEventListener("change", event => event.target.files[0] && importData(event.target.files[0]));
window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "today"));

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));

function registerWebMcp() {
  const context = document.modelContext; if (!context?.registerTool) return;
  const register = tool => Promise.resolve(context.registerTool(tool)).catch(() => {});
  register({ name:"list_today_tasks", title:"List today's tasks", description:"Read today's Dailo tasks and their progress.", inputSchema:{type:"object",properties:{},additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false}, execute:() => todayTasks().map(task => ({id:task.id,title:task.title,progress:taskProgress(task),done:task.done})) });
  register({ name:"create_today_task", title:"Create a task", description:"Create a new task in today's Dailo list.", inputSchema:{type:"object",properties:{title:{type:"string"},notes:{type:"string"},priority:{type:"string",enum:["low","normal","high"]}},required:["title"],additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:false}, execute: input => { if (!input?.title?.trim()) throw new Error("A title is required"); const task={id:uid(),date:todayKey(),title:input.title.trim(),notes:input.notes?.trim()||"",priority:input.priority||"normal",time:"",type:"check",goal:null,progress:0,done:false,createdAt:Date.now()}; state.tasks.push(task); saveState(); return {id:task.id,status:"created"}; } });
}

render(); navigate(location.hash.slice(1) || "today"); registerWebMcp();

