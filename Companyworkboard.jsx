import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
    Home, ClipboardList, Clock, Calendar as CalendarIcon, BarChart2, Users,
    Settings as SettingsIcon, Bell, Plus, ChevronLeft, ChevronRight,
    MoreVertical, Flag, X, Upload, Download, Eye, Trash2, Pencil, CheckCircle2,
    Circle, PlayCircle, FileText, FileSpreadsheet, Presentation, Image as ImageIcon,
    File as FileIcon, Send, Search, ChevronDown, AlertTriangle, CheckCheck,
    LogOut, Shield, User, Moon, Sun, BellRing, Palette, FolderOpen, TrendingUp,
    Activity, Target, ArrowRight, Menu, MoreHorizontal, Briefcase
} from "lucide-react";

/* ============================================================================
   BIZZ WORKBOARD — Personal Daily Work Record System
   ----------------------------------------------------------------------------
   Single-file prototype. All data lives in React state + localStorage.

   Core principle: This is NOT a team-wide task board. It is a PERSONAL DAILY
   WORK RECORD SYSTEM. Employees see only THEIR OWN work. Managers have
   additional access to authorized employee records via Management.

   To wire this up to a real backend later:
     - Replace localStorage with API fetch on mount.
     - Replace the state setters with API calls, keeping the same shapes.
     - Auth / roles: swap role-switching for real session auth.
   ==========================================================================*/

/* ---------------------------------- data --------------------------------- */

const EMPLOYEES = [
    { id: "jeewan", name: "Jeewan Thakur", designation: "UI/UX Designer", role: "employee", department: "Design", initials: "JT" },
    { id: "aarav", name: "Aarav Sharma", designation: "Developer", role: "employee", department: "Engineering", initials: "AS" },
    { id: "sita", name: "Sita Rai", designation: "Marketing", role: "employee", department: "Marketing", initials: "SR" },
    { id: "binita", name: "Binita KC", designation: "QA Engineer", role: "employee", department: "Engineering", initials: "BK" },
    { id: "nisha", name: "Nisha Gurung", designation: "Engineering Manager", role: "manager", department: "Management", initials: "NG" },
];

const PROJECTS = ["Client Project", "Internal Project", "Website Project"];
const PRIORITIES = ["Low", "Normal", "High"];
const STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const STATUS_LABEL = { TODO: "To Do", IN_PROGRESS: "In Progress", REVIEW: "Review", DONE: "Done" };
const STATUS_DOT = { TODO: "var(--red)", IN_PROGRESS: "var(--blue)", REVIEW: "#c98bf0", DONE: "var(--green)" };

const TODAY = new Date();
const YESTERDAY = addDays(TODAY, -1);
const DAY_BEFORE = addDays(TODAY, -2);

let _id = 1000;
const uid = (p = "id") => `${p}_${_id++}`;

const STORAGE_KEY = "bizz_workboard_state";
const SETTINGS_KEY = "bizz_workboard_settings";

/* --------------------------------- utils --------------------------------- */

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}
function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatLongDate(d) {
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function formatShortDate(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatMonthYear(d) {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Dynamic greeting based on browser's local time
// 5:00 AM – 11:59 AM  → Good Morning
// 12:00 PM – 4:59 PM  → Good Afternoon
// 5:00 PM – 4:59 AM   → Good Evening
function getGreeting() {
    const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Kathmandu", hour: 'numeric', hour12: false }));
    if (h >= 5 && h < 12) return "Good Morning";
    if (h >= 12 && h < 17) return "Good Afternoon";
    return "Good Evening";
}

function to12h(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}
function minutesBetween(start, end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
}
function formatDuration(mins) {
    if (mins == null || isNaN(mins)) return "—";
    if (mins <= 0) return "0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
function formatDurationPadded(mins) {
    const h = Math.floor(Math.max(mins, 0) / 60);
    const m = Math.max(mins, 0) % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

// Bikram Sambat (Nepali calendar) conversion — anchored on the confirmed
// reference point Baisakh 1, 2083 BS = April 14, 2026 AD, with BS 2083's
// known month lengths. Later/earlier years reuse this month-length pattern,
// which is standard practice for a prototype without a full multi-century
// BS data table.
const BS_MONTH_NAMES = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
const BS_MONTH_LENGTHS = [31, 32, 31, 31, 31, 31, 30, 30, 29, 29, 30, 31];
function toBS(date) {
    const y = date.getFullYear();
    let anchor = new Date(y, 3, 14);
    let bsYear = y + 57;
    const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (d0 < anchor) {
        anchor = new Date(y - 1, 3, 14);
        bsYear = y - 1 + 57;
    }
    let offset = Math.round((d0 - anchor) / 86400000);
    let idx = 0;
    while (offset >= BS_MONTH_LENGTHS[idx]) {
        offset -= BS_MONTH_LENGTHS[idx];
        idx++;
        if (idx === 12) {
            idx = 0;
            bsYear++;
        }
    }
    return { year: bsYear, month: BS_MONTH_NAMES[idx], day: offset + 1 };
}
function formatBS(date) {
    const bs = toBS(date);
    return `${bs.month} ${bs.day}, ${bs.year}`;
}

/* ---------------------------- mock data seed ------------------------------ */
/* TASK_SHAPE: { id, title, description, employeeId, dateKey, status, priority,
   dueDate, project, createdAt, completedAt, comments } */
/* WORKLOG_SHAPE: { id, employeeId, dateKey, taskId, description, start, end,
   duration, project, notes } */
/* SUMMARY_SHAPE: key `${employeeId}__${dateKey}` -> { accomplishments,
   blockers, tomorrowPlan, submitted, submittedAt, managerReviewed,
   managerComment } */
/* REPORT_SHAPE: { id, employeeId, fileName, fileType, fileSize, uploadedAt,
   uploadedBy, status, url } */

function buildInitialData() {
    const todayKey = dateKey(TODAY);
    const yKey = dateKey(YESTERDAY);
    const dbKey = dateKey(DAY_BEFORE);

    const tasks = [
        { id: uid("t"), title: "Prepare client proposal", description: "Draft and finalize the proposal deck for the client pitch on Thursday.", employeeId: "jeewan", dateKey: todayKey, status: "TODO", priority: "High", dueDate: dateKey(addDays(TODAY, 1)), project: "Client Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Update website design", description: "Refresh the homepage hero and nav per the new brand guidelines.", employeeId: "jeewan", dateKey: todayKey, status: "TODO", priority: "Normal", dueDate: dateKey(addDays(TODAY, 1)), project: "Website Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Client meeting", description: "Walk the client through the current proposal draft and gather feedback.", employeeId: "jeewan", dateKey: todayKey, status: "IN_PROGRESS", priority: "Normal", dueDate: todayKey, project: "Client Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Design system update", description: "Update shared color and spacing tokens in the component library.", employeeId: "jeewan", dateKey: todayKey, status: "IN_PROGRESS", priority: "High", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Website homepage", description: "Final QA pass on the new homepage build before it ships.", employeeId: "jeewan", dateKey: todayKey, status: "REVIEW", priority: "Normal", dueDate: todayKey, project: "Website Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Respond to emails", description: "Clear the morning inbox backlog.", employeeId: "jeewan", dateKey: todayKey, status: "DONE", priority: "Low", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "09:30 AM", comments: [] },
        { id: uid("t"), title: "Team stand-up meeting", description: "Daily sync with the design team.", employeeId: "jeewan", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "08:45 AM", comments: [] },

        { id: uid("t"), title: "Wireframe onboarding flow", description: "Low-fidelity wireframes for the new user onboarding.", employeeId: "jeewan", dateKey: yKey, status: "DONE", priority: "Normal", dueDate: yKey, project: "Internal Project", createdAt: Date.now(), completedAt: "04:10 PM", comments: [] },
        { id: uid("t"), title: "Review pull request", description: "Reviewed the navigation refactor PR from Aarav.", employeeId: "jeewan", dateKey: yKey, status: "DONE", priority: "Low", dueDate: yKey, project: "Website Project", createdAt: Date.now(), completedAt: "05:00 PM", comments: [] },
        { id: uid("t"), title: "Client feedback call", description: "Follow-up call to discuss revision notes.", employeeId: "jeewan", dateKey: yKey, status: "DONE", priority: "High", dueDate: yKey, project: "Client Project", createdAt: Date.now(), completedAt: "02:15 PM", comments: [] },

        { id: uid("t"), title: "Brand style guide draft", description: "First draft of the updated brand style guide.", employeeId: "jeewan", dateKey: dbKey, status: "DONE", priority: "Normal", dueDate: dbKey, project: "Internal Project", createdAt: Date.now(), completedAt: "03:40 PM", comments: [] },
        { id: uid("t"), title: "Icon set cleanup", description: "Standardized stroke widths across the icon set.", employeeId: "jeewan", dateKey: dbKey, status: "DONE", priority: "Low", dueDate: dbKey, project: "Website Project", createdAt: Date.now(), completedAt: "11:20 AM", comments: [] },

        // Aarav's tasks
        { id: uid("t"), title: "Navigation refactor", description: "Refactor the main nav component for better maintainability.", employeeId: "aarav", dateKey: todayKey, status: "DONE", priority: "High", dueDate: todayKey, project: "Website Project", createdAt: Date.now(), completedAt: "11:30 AM", comments: [] },
        { id: uid("t"), title: "API endpoint setup", description: "Set up REST endpoints for task CRUD operations.", employeeId: "aarav", dateKey: todayKey, status: "IN_PROGRESS", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Bug fix: login form", description: "Fix validation on the login form.", employeeId: "aarav", dateKey: todayKey, status: "DONE", priority: "High", dueDate: todayKey, project: "Website Project", createdAt: Date.now(), completedAt: "10:15 AM", comments: [] },
        { id: uid("t"), title: "Code review session", description: "Review Binita's QA automation PR.", employeeId: "aarav", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "02:45 PM", comments: [] },
        { id: uid("t"), title: "Database schema update", description: "Add new fields for worklog tracking.", employeeId: "aarav", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "04:20 PM", comments: [] },
        { id: uid("t"), title: "Sprint planning prep", description: "Prepare estimates for next sprint.", employeeId: "aarav", dateKey: todayKey, status: "DONE", priority: "Low", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "09:00 AM", comments: [] },
        { id: uid("t"), title: "CI pipeline fix", description: "Fix broken test in CI pipeline.", employeeId: "aarav", dateKey: todayKey, status: "DONE", priority: "High", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "03:30 PM", comments: [] },
        { id: uid("t"), title: "Documentation update", description: "Update API docs for new endpoints.", employeeId: "aarav", dateKey: todayKey, status: "TODO", priority: "Low", dueDate: dateKey(addDays(TODAY, 1)), project: "Internal Project", createdAt: Date.now(), completedAt: null, comments: [] },

        // Sita's tasks
        { id: uid("t"), title: "Social media campaign", description: "Draft posts for the September campaign.", employeeId: "sita", dateKey: todayKey, status: "IN_PROGRESS", priority: "High", dueDate: todayKey, project: "Client Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Analytics report", description: "Compile the August engagement report.", employeeId: "sita", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "11:00 AM", comments: [] },
        { id: uid("t"), title: "Brand guidelines review", description: "Review and approve the new brand guidelines.", employeeId: "sita", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "03:15 PM", comments: [] },
        { id: uid("t"), title: "Client presentation", description: "Present campaign results to the client.", employeeId: "sita", dateKey: todayKey, status: "TODO", priority: "High", dueDate: dateKey(addDays(TODAY, 1)), project: "Client Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Newsletter draft", description: "Write the September newsletter.", employeeId: "sita", dateKey: todayKey, status: "DONE", priority: "Low", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "04:00 PM", comments: [] },

        // Binita's tasks
        { id: uid("t"), title: "Regression testing", description: "Run regression tests on the release branch.", employeeId: "binita", dateKey: todayKey, status: "DONE", priority: "High", dueDate: todayKey, project: "Website Project", createdAt: Date.now(), completedAt: "01:30 PM", comments: [] },
        { id: uid("t"), title: "Automation scripts", description: "Write test scripts for new features.", employeeId: "binita", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "10:30 AM", comments: [] },
        { id: uid("t"), title: "Bug triaging", description: "Triage and prioritize reported bugs.", employeeId: "binita", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Website Project", createdAt: Date.now(), completedAt: "09:45 AM", comments: [] },
        { id: uid("t"), title: "Test plan update", description: "Update the test plan for Q4.", employeeId: "binita", dateKey: todayKey, status: "DONE", priority: "Low", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "03:00 PM", comments: [] },
        { id: uid("t"), title: "Performance testing", description: "Run load tests on the staging environment.", employeeId: "binita", dateKey: todayKey, status: "DONE", priority: "High", dueDate: todayKey, project: "Website Project", createdAt: Date.now(), completedAt: "04:45 PM", comments: [] },
        { id: uid("t"), title: "QA standup notes", description: "Document QA standup findings.", employeeId: "binita", dateKey: todayKey, status: "IN_PROGRESS", priority: "Low", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Checkout flow test", description: "Investigate flaky test on checkout.", employeeId: "binita", dateKey: todayKey, status: "TODO", priority: "High", dueDate: dateKey(addDays(TODAY, 1)), project: "Website Project", createdAt: Date.now(), completedAt: null, comments: [] },

        // Nisha's tasks (manager)
        { id: uid("t"), title: "Team performance review", description: "Prepare Q3 performance reviews for the team.", employeeId: "nisha", dateKey: todayKey, status: "IN_PROGRESS", priority: "High", dueDate: dateKey(addDays(TODAY, 2)), project: "Internal Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Sprint retrospective", description: "Facilitate the sprint retrospective meeting.", employeeId: "nisha", dateKey: todayKey, status: "DONE", priority: "Normal", dueDate: todayKey, project: "Internal Project", createdAt: Date.now(), completedAt: "11:30 AM", comments: [] },
        { id: uid("t"), title: "Budget planning", description: "Review Q4 budget allocations.", employeeId: "nisha", dateKey: todayKey, status: "TODO", priority: "High", dueDate: dateKey(addDays(TODAY, 3)), project: "Internal Project", createdAt: Date.now(), completedAt: null, comments: [] },
        { id: uid("t"), title: "Client escalation call", description: "Handle the escalated support ticket.", employeeId: "nisha", dateKey: todayKey, status: "DONE", priority: "High", dueDate: todayKey, project: "Client Project", createdAt: Date.now(), completedAt: "10:00 AM", comments: [] },
    ];

    const worklogs = [
        { id: uid("w"), employeeId: "jeewan", dateKey: todayKey, taskId: tasks[0].id, description: "Prepare client proposal", project: "Client Project", start: "09:00", end: "10:30", notes: "Drafted sections 1-3." },
        { id: uid("w"), employeeId: "jeewan", dateKey: todayKey, taskId: tasks[2].id, description: "Client meeting", project: "Client Project", start: "10:30", end: "11:00", notes: "" },
        { id: uid("w"), employeeId: "jeewan", dateKey: todayKey, taskId: tasks[3].id, description: "Design system update", project: "Internal Project", start: "11:15", end: "13:00", notes: "Updated color tokens." },
        { id: uid("w"), employeeId: "jeewan", dateKey: todayKey, taskId: tasks[1].id, description: "Update website design", project: "Website Project", start: "14:00", end: "15:15", notes: "" },

        { id: uid("w"), employeeId: "jeewan", dateKey: yKey, taskId: tasks[7].id, description: "Wireframe onboarding flow", project: "Internal Project", start: "09:15", end: "11:45", notes: "" },
        { id: uid("w"), employeeId: "jeewan", dateKey: yKey, taskId: tasks[9].id, description: "Client feedback call", project: "Client Project", start: "13:30", end: "14:15", notes: "" },
        { id: uid("w"), employeeId: "jeewan", dateKey: yKey, taskId: tasks[8].id, description: "Review pull request", project: "Website Project", start: "16:00", end: "17:00", notes: "" },

        { id: uid("w"), employeeId: "jeewan", dateKey: dbKey, taskId: tasks[10].id, description: "Brand style guide draft", project: "Internal Project", start: "10:00", end: "13:40", notes: "" },
        { id: uid("w"), employeeId: "jeewan", dateKey: dbKey, taskId: tasks[11].id, description: "Icon set cleanup", project: "Website Project", start: "09:00", end: "11:20", notes: "" },

        // Other employees' worklogs
        { id: uid("w"), employeeId: "aarav", dateKey: todayKey, taskId: null, description: "Navigation refactor", project: "Website Project", start: "09:00", end: "11:30", notes: "Completed the refactor." },
        { id: uid("w"), employeeId: "aarav", dateKey: todayKey, taskId: null, description: "API endpoint setup", project: "Internal Project", start: "13:00", end: "15:10", notes: "" },
        { id: uid("w"), employeeId: "aarav", dateKey: todayKey, taskId: null, description: "Code review session", project: "Internal Project", start: "15:30", end: "16:30", notes: "" },

        { id: uid("w"), employeeId: "sita", dateKey: todayKey, taskId: null, description: "Social media campaign", project: "Client Project", start: "09:30", end: "11:00", notes: "" },
        { id: uid("w"), employeeId: "sita", dateKey: todayKey, taskId: null, description: "Analytics report", project: "Internal Project", start: "11:30", end: "13:00", notes: "" },
        { id: uid("w"), employeeId: "sita", dateKey: todayKey, taskId: null, description: "Newsletter draft", project: "Internal Project", start: "14:00", end: "15:10", notes: "" },

        { id: uid("w"), employeeId: "binita", dateKey: todayKey, taskId: null, description: "Regression testing", project: "Website Project", start: "09:00", end: "13:30", notes: "" },
        { id: uid("w"), employeeId: "binita", dateKey: todayKey, taskId: null, description: "Performance testing", project: "Website Project", start: "14:00", end: "16:40", notes: "" },

        { id: uid("w"), employeeId: "nisha", dateKey: todayKey, taskId: null, description: "Sprint retrospective", project: "Internal Project", start: "09:30", end: "11:30", notes: "" },
        { id: uid("w"), employeeId: "nisha", dateKey: todayKey, taskId: null, description: "Client escalation call", project: "Client Project", start: "13:00", end: "14:00", notes: "" },
        { id: uid("w"), employeeId: "nisha", dateKey: todayKey, taskId: null, description: "Team performance review", project: "Internal Project", start: "14:30", end: "16:30", notes: "" },
    ].map((w) => ({ ...w, duration: minutesBetween(w.start, w.end) }));

    const summaries = {
        [`jeewan__${todayKey}`]: {
            accomplishments: "Completed the client proposal draft and had a productive discussion in the client meeting.",
            blockers: "Waiting for client feedback on the proposal changes.",
            tomorrowPlan: "Continue working on the website design and finalize the proposal.",
            submitted: false, submittedAt: null, managerReviewed: false, managerComment: "",
        },
        [`jeewan__${yKey}`]: {
            accomplishments: "Wrapped up the onboarding wireframes and reviewed a teammate's pull request.",
            blockers: "None.",
            tomorrowPlan: "Start the client proposal draft.",
            submitted: true, submittedAt: "05:45 PM", managerReviewed: true, managerComment: "Nice progress — thanks for the quick PR turnaround.",
        },
        [`jeewan__${dbKey}`]: {
            accomplishments: "Finished the first pass of the brand style guide and cleaned up the icon set.",
            blockers: "None.",
            tomorrowPlan: "Pick up onboarding wireframes.",
            submitted: true, submittedAt: "06:02 PM", managerReviewed: false, managerComment: "",
        },
        [`aarav__${todayKey}`]: { accomplishments: "Shipped the navigation refactor and started API endpoint setup.", blockers: "None.", tomorrowPlan: "Complete API integration and update documentation.", submitted: true, submittedAt: "05:30 PM", managerReviewed: false, managerComment: "" },
        [`sita__${todayKey}`]: { accomplishments: "", blockers: "", tomorrowPlan: "", submitted: false, submittedAt: null, managerReviewed: false, managerComment: "" },
        [`binita__${todayKey}`]: { accomplishments: "Regression pass on the release branch. Performance testing completed.", blockers: "One flaky test on checkout flow.", tomorrowPlan: "Investigate the flaky test and update QA docs.", submitted: true, submittedAt: "06:10 PM", managerReviewed: false, managerComment: "" },
        [`nisha__${todayKey}`]: { accomplishments: "Facilitated sprint retrospective, handled client escalation, started performance reviews.", blockers: "Waiting on HR for review templates.", tomorrowPlan: "Continue performance reviews and budget planning.", submitted: false, submittedAt: null, managerReviewed: false, managerComment: "" },
    };

    const reports = [
        { id: uid("r"), employeeId: "jeewan", fileName: "September Client Report.docx", fileType: "DOCX", fileSize: "184 KB", uploadedAt: todayKey, uploadedBy: "Jeewan Thakur", status: "Stored", storageType: "local-prototype", url: null },
        { id: uid("r"), employeeId: "jeewan", fileName: "Website Progress.xlsx", fileType: "XLSX", fileSize: "96 KB", uploadedAt: todayKey, uploadedBy: "Jeewan Thakur", status: "Stored", storageType: "local-prototype", url: null },
        { id: uid("r"), employeeId: "jeewan", fileName: "August Monthly Summary.pdf", fileType: "PDF", fileSize: "612 KB", uploadedAt: dateKey(addDays(TODAY, -1)), uploadedBy: "Jeewan Thakur", status: "Stored", storageType: "local-prototype", url: null },
    ];

    return { tasks, worklogs, summaries, reports };
}

/* ------------------------------- small UI --------------------------------- */

function Avatar({ name, size = 34 }) {
    const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    return (
        <div className="cw-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
            {initials}
        </div>
    );
}

function PriorityTag({ priority }) {
    const color = priority === "High" ? "var(--red)" : priority === "Normal" ? "var(--blue)" : "var(--text-dim)";
    return (
        <span className="cw-priority" style={{ color }}>
            <Flag size={12} style={{ fill: color, color }} /> {priority} Priority
        </span>
    );
}

function StatusPill({ status }) {
    return (
        <span className="cw-status-pill" style={{ "--dot": STATUS_DOT[status] }}>
            <span className="cw-dot" /> {STATUS_LABEL[status]}
        </span>
    );
}

function IconForFile(type) {
    const t = (type || "").toLowerCase();
    if (["doc", "docx"].includes(t)) return <FileText size={18} color="#5b8def" />;
    if (["pdf"].includes(t)) return <FileText size={18} color="var(--red)" />;
    if (["xls", "xlsx", "csv"].includes(t)) return <FileSpreadsheet size={18} color="var(--green)" />;
    if (["ppt", "pptx"].includes(t)) return <Presentation size={18} color="#f2a63c" />;
    if (["png", "jpg", "jpeg"].includes(t)) return <ImageIcon size={18} color="#c98bf0" />;
    return <FileIcon size={18} color="var(--text-dim)" />;
}

function Modal({ title, onClose, children, width = 520 }) {
    return (
        <div className="cw-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cw-modal" style={{ maxWidth: width }}>
                <div className="cw-modal-head">
                    <h3>{title}</h3>
                    <button className="cw-icon-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="cw-modal-body">{children}</div>
            </div>
        </div>
    );
}

function ToastStack({ toasts }) {
    return (
        <div className="cw-toast-stack">
            {toasts.map((t) => (
                <div className={`cw-toast cw-toast-${t.type}`} key={t.id}>
                    {t.type === "success" ? <CheckCheck size={16} /> : <AlertTriangle size={16} />}
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ icon, title, note }) {
    return (
        <div className="cw-empty">
            {icon}
            <p className="cw-empty-title">{title}</p>
            {note && <p className="cw-empty-note">{note}</p>}
        </div>
    );
}

/* --------------------------------- Bizz Logo -------------------------------- */

function BizzLogo({ size = 34 }) {
    return (
        <div className="cw-bizz-logo" style={{ width: size, height: size, fontSize: size * 0.44 }}>
            B
        </div>
    );
}

function LiveClock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="cw-live-clock">
            <Clock size={13} />
            <span>{time.toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu" })}</span>
        </div>
    );
}

/* --------------------------------- Sidebar -------------------------------- */

function Sidebar({ page, setPage, currentEmployee, mobileOpen, setMobileOpen }) {
    const isManager = currentEmployee.role === "manager";

    const navItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "tasks", label: "My Tasks", icon: ClipboardList },
        { id: "worklog", label: "Worklog", icon: Clock },
        { id: "calendar", label: "Calendar", icon: CalendarIcon },
        { id: "reports", label: "Reports", icon: FolderOpen },
        { id: "summary", label: "Daily Summary", icon: FileText },
    ];

    const navItems2 = [
        ...(isManager ? [{ id: "management", label: "Management", icon: Users }] : []),
        { id: "settings", label: "Settings", icon: SettingsIcon },
    ];

    const go = (id) => { setPage(id); setMobileOpen(false); };

    return (
        <>
            {mobileOpen && <div className="cw-sidebar-scrim" onClick={() => setMobileOpen(false)} />}
            <aside className={`cw-sidebar ${mobileOpen ? "cw-sidebar-open" : ""}`}>
                <div className="cw-logo-row">
                    <BizzLogo size={36} />
                    <div>
                        <div className="cw-logo-title">Bizz</div>
                        <div className="cw-logo-sub">Workboard</div>
                    </div>
                </div>

                <div style={{ padding: "0 10px 16px" }}>
                    <LiveClock />
                </div>

                <nav className="cw-nav">
                    {navItems.map((it) => (
                        <button key={it.id} className={`cw-nav-item ${page === it.id ? "active" : ""}`} onClick={() => go(it.id)}>
                            <it.icon size={18} />
                            <span>{it.label}</span>
                        </button>
                    ))}
                    <div className="cw-nav-divider" />
                    {navItems2.map((it) => (
                        <button key={it.id} className={`cw-nav-item ${page === it.id ? "active" : ""}`} onClick={() => go(it.id)}>
                            <it.icon size={18} />
                            <span>{it.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="cw-sidebar-profile">
                    <Avatar name={currentEmployee.name} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cw-profile-name">{currentEmployee.name}</div>
                        <div className="cw-profile-role">{currentEmployee.designation}</div>
                    </div>
                    {currentEmployee.role === "manager" && (
                        <span className="cw-role-badge"><Shield size={12} /> Mgr</span>
                    )}
                </div>
            </aside>
        </>
    );
}

/* ------------------------------- Date header ------------------------------ */

function DateNav({ selectedDate, setSelectedDate, onAddTask, showAddTask = false }) {
    const isToday = sameDay(selectedDate, TODAY);
    const isFuture = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) > new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    return (
        <div className="cw-date-nav">
            <button className="cw-pill-btn" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Previous day">
                <ChevronLeft size={16} />
            </button>
            <button className={`cw-pill-btn cw-pill-btn-wide ${isToday ? "is-today" : ""}`} onClick={() => setSelectedDate(new Date(TODAY))}>
                <CalendarIcon size={15} /> {isToday ? "Today" : formatShortDate(selectedDate)}
            </button>
            <button className="cw-pill-btn" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Next day" disabled={isFuture} style={{ opacity: isFuture ? 0.4 : 1 }}>
                <ChevronRight size={16} />
            </button>
            {showAddTask && (
                <button className="cw-btn-primary" onClick={onAddTask}>
                    <Plus size={16} /> Add Task
                </button>
            )}
        </div>
    );
}

/* -------------------------------- Dashboard -------------------------------- */
/* Dashboard is ANALYTICS-ONLY. No task/worklog/summary controls. */

function Dashboard({ state, currentEmployee }) {
    const todayKey = dateKey(TODAY);
    const todayTasks = state.tasks.filter((t) => t.employeeId === currentEmployee.id && t.dateKey === todayKey);
    const todayWorklogs = state.worklogs.filter((w) => w.employeeId === currentEmployee.id && w.dateKey === todayKey);
    const totalMinutes = todayWorklogs.reduce((s, w) => s + w.duration, 0);
    const done = todayTasks.filter((t) => t.status === "DONE").length;
    const pending = todayTasks.filter((t) => t.status !== "DONE").length;
    const completionPct = todayTasks.length > 0 ? Math.round((done / todayTasks.length) * 100) : 0;

    // Weekly activity: last 7 days
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
        const d = addDays(TODAY, -i);
        const dk = dateKey(d);
        const dayTasks = state.tasks.filter((t) => t.employeeId === currentEmployee.id && t.dateKey === dk);
        const dayWorklogs = state.worklogs.filter((w) => w.employeeId === currentEmployee.id && w.dateKey === dk);
        const dayDone = dayTasks.filter((t) => t.status === "DONE").length;
        const dayMins = dayWorklogs.reduce((s, w) => s + w.duration, 0);
        weekData.push({
            label: d.toLocaleDateString("en-US", { weekday: "short" }),
            date: formatShortDate(d),
            tasks: dayTasks.length,
            done: dayDone,
            minutes: dayMins,
            isToday: sameDay(d, TODAY),
        });
    }
    const maxMins = Math.max(...weekData.map((d) => d.minutes), 60);

    // Monthly stats
    const monthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    const monthTasks = state.tasks.filter((t) => t.employeeId === currentEmployee.id && t.dateKey >= dateKey(monthStart));
    const monthDone = monthTasks.filter((t) => t.status === "DONE").length;
    const monthWorklogs = state.worklogs.filter((w) => w.employeeId === currentEmployee.id && w.dateKey >= dateKey(monthStart));
    const monthMinutes = monthWorklogs.reduce((s, w) => s + w.duration, 0);

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-hello">{getGreeting()}, {currentEmployee.name.split(" ")[0]} 👋</h1>
                    <h2 className="cw-date-title">{formatLongDate(TODAY)}</h2>
                    <p className="cw-subtle">Here's your productivity overview.</p>
                </div>
            </div>

            <div className="cw-stat-grid">
                <div className="cw-stat-card">
                    <div className="cw-stat-icon cw-tone-blue"><Target size={20} /></div>
                    <div>
                        <div className="cw-stat-label">TASK COMPLETION</div>
                        <div className="cw-stat-value">{completionPct}%</div>
                        <div className="cw-stat-note">{todayTasks.length} total today</div>
                    </div>
                </div>
                <div className="cw-stat-card">
                    <div className="cw-stat-icon cw-tone-green"><CheckCircle2 size={20} /></div>
                    <div>
                        <div className="cw-stat-label">COMPLETED</div>
                        <div className="cw-stat-value">{String(done).padStart(2, "0")}</div>
                        <div className="cw-stat-note">Well done!</div>
                    </div>
                </div>
                <div className="cw-stat-card">
                    <div className="cw-stat-icon cw-tone-red"><PlayCircle size={20} /></div>
                    <div>
                        <div className="cw-stat-label">PENDING</div>
                        <div className="cw-stat-value">{String(pending).padStart(2, "0")}</div>
                        <div className="cw-stat-note">Keep going</div>
                    </div>
                </div>
                <div className="cw-stat-card">
                    <div className="cw-stat-icon cw-tone-purple"><Clock size={20} /></div>
                    <div>
                        <div className="cw-stat-label">WORK HOURS</div>
                        <div className="cw-stat-value">{formatDurationPadded(totalMinutes)}</div>
                        <div className="cw-stat-note">Logged today</div>
                    </div>
                </div>
            </div>

            <div className="cw-dashboard-analytics">
                <div className="cw-panel cw-weekly-panel">
                    <div className="cw-panel-head">
                        <h3>Weekly Activity</h3>
                        <span className="cw-subtle-sm">Last 7 days</span>
                    </div>
                    <div className="cw-weekly-chart">
                        {weekData.map((d, i) => (
                            <div className={`cw-weekly-bar-wrap ${d.isToday ? "is-today" : ""}`} key={i}>
                                <div className="cw-weekly-bar-track">
                                    <div
                                        className="cw-weekly-bar"
                                        style={{ height: `${Math.max((d.minutes / maxMins) * 100, 4)}%` }}
                                    />
                                </div>
                                <div className="cw-weekly-label">{d.label}</div>
                                <div className="cw-weekly-val">{formatDuration(d.minutes)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="cw-dashboard-side-stack">
                    <div className="cw-panel cw-month-panel">
                        <div className="cw-panel-head">
                            <h3>Monthly Overview</h3>
                            <span className="cw-subtle-sm">{formatMonthYear(TODAY)}</span>
                        </div>

                        <div className="cw-completion-ring-wrap">
                            <svg viewBox="0 0 120 120" className="cw-completion-ring">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                <circle
                                    cx="60" cy="60" r="50" fill="none"
                                    stroke="var(--red)" strokeWidth="10" strokeLinecap="round"
                                    strokeDasharray={`${completionPct * 3.14} ${314 - completionPct * 3.14}`}
                                    transform="rotate(-90 60 60)"
                                />
                            </svg>
                            <div className="cw-completion-center">
                                <span className="cw-completion-pct">{completionPct}%</span>
                                <span className="cw-completion-label">Today</span>
                            </div>
                        </div>

                        <div className="cw-month-stats">
                            <div className="cw-cal-detail-stat"><span>Total Tasks</span><strong>{monthTasks.length}</strong></div>
                            <div className="cw-cal-detail-stat"><span>Completed</span><strong className="cw-text-green">{monthDone}</strong></div>
                            <div className="cw-cal-detail-stat"><span>Work Hours</span><strong>{formatDuration(monthMinutes)}</strong></div>
                        </div>
                    </div>

                    <div className="cw-panel cw-notify-panel">
                        <div className="cw-panel-head" style={{ marginBottom: 12 }}>
                            <h3><Bell size={16} /> Notifications</h3>
                        </div>
                        <div className="cw-notify-list">
                            <div className="cw-notify-item">
                                <div className="cw-notify-text">Daily summary due soon.</div>
                                <div className="cw-notify-time">Today, 4:00 PM</div>
                            </div>
                            <div className="cw-notify-item">
                                <div className="cw-notify-text">Don't forget to log your work hours for today.</div>
                                <div className="cw-notify-time">Today, 1:00 PM</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* -------------------------------- My Tasks --------------------------------- */
/* My Tasks contains ONLY Kanban task management. No Worklog. */

function MyTasksPage({ state, selectedDate, setSelectedDate, actions, currentEmployee }) {
    const key = dateKey(selectedDate);
    const tasks = state.tasks.filter((t) => t.employeeId === currentEmployee.id && t.dateKey === key);
    const [dragOverCol, setDragOverCol] = useState(null);
    const isToday = sameDay(selectedDate, TODAY);

    const onDrop = (status) => (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain");
        actions.moveTask(taskId, status);
        setDragOverCol(null);
    };

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">My Tasks</h1>
                    <p className="cw-subtle">{isToday ? "Manage your tasks for today." : `Viewing tasks for ${formatShortDate(selectedDate)}.`}</p>
                </div>
                <DateNav selectedDate={selectedDate} setSelectedDate={setSelectedDate} showAddTask onAddTask={() => actions.openTaskModal(null, "TODO", key)} />
            </div>

            <div className="cw-kanban">
                {STATUSES.map((status) => {
                    const items = tasks.filter((t) => t.status === status);
                    return (
                        <div
                            key={status}
                            className={`cw-kanban-col ${dragOverCol === status ? "drag-over" : ""}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
                            onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                            onDrop={onDrop(status)}
                        >
                            <div className="cw-kanban-col-head">
                                <span className="cw-dot" style={{ background: STATUS_DOT[status] }} />
                                <span>{STATUS_LABEL[status]}</span>
                                <span className="cw-mini-count">{items.length}</span>
                            </div>
                            <div className="cw-kanban-col-body">
                                {items.map((t) => (
                                    <TaskCard key={t.id} task={t} onEdit={() => actions.openTaskModal(t)} onDelete={() => actions.deleteTask(t.id)} />
                                ))}
                                <button className="cw-add-task-inline" onClick={() => actions.openTaskModal(null, status, key)}><Plus size={14} /> Add Task</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function TaskCard({ task, onEdit, onDelete }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return (
        <div className="cw-task-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)} onClick={onEdit}>
            <div className="cw-task-card-top">
                <span className={task.status === "DONE" ? "cw-strike" : ""}>{task.title}</span>
                <div className="cw-menu-wrap">
                    <button className="cw-icon-btn cw-icon-btn-tiny" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}><MoreVertical size={14} /></button>
                    {menuOpen && (
                        <div className="cw-menu" onMouseLeave={() => setMenuOpen(false)}>
                            <button onClick={(e) => { e.stopPropagation(); onEdit(); setMenuOpen(false); }}><Pencil size={13} /> Edit</button>
                            <button className="danger" onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}><Trash2 size={13} /> Delete</button>
                        </div>
                    )}
                </div>
            </div>
            <div className="cw-task-card-meta">
                <PriorityTag priority={task.priority} />
                {task.project && <span className="cw-task-project">{task.project}</span>}
            </div>
            <div className="cw-task-card-bottom">
                {task.status === "DONE" ? (
                    <span className="cw-done-label"><CheckCircle2 size={13} color="var(--green)" /> Completed {task.completedAt}</span>
                ) : (
                    <span className="cw-task-due"><CalendarIcon size={12} /> {task.dueDate === dateKey(TODAY) ? "Today" : formatShortDate(new Date(task.dueDate))}</span>
                )}
            </div>
        </div>
    );
}

/* -------------------------------- Worklog page ------------------------------ */
/* Worklog is a completely separate page. No Summary panel. */

function WorklogPage({ state, selectedDate, setSelectedDate, actions, currentEmployee }) {
    const key = dateKey(selectedDate);
    const worklogs = state.worklogs.filter((w) => w.employeeId === currentEmployee.id && w.dateKey === key);
    const totalMinutes = worklogs.reduce((s, w) => s + w.duration, 0);
    const sorted = [...worklogs].sort((a, b) => a.start.localeCompare(b.start));
    const isToday = sameDay(selectedDate, TODAY);

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">Worklog</h1>
                    <p className="cw-subtle">Record what you actually worked on.</p>
                </div>
                <DateNav selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            </div>

            <div className="cw-panel">
                <div className="cw-panel-head">
                    <div>
                        <h3>{formatLongDate(selectedDate)}</h3>
                        <span className="cw-subtle-sm">{formatDurationPadded(totalMinutes)} logged {isToday ? "today" : "that day"} (NPT / UTC+5:45)</span>
                    </div>
                    <button className="cw-btn-primary" onClick={() => actions.openWorklogModal(key)}><Plus size={14} /> Add Worklog</button>
                </div>
                {sorted.length === 0 ? (
                    <EmptyState icon={<Clock size={26} color="var(--text-dimmer)" />} title="Nothing logged for this day" note="Use Add Worklog to record what you worked on." />
                ) : (
                    <div className="cw-worklog-table">
                        <div className="cw-worklog-row cw-worklog-head">
                            <span>Time</span><span>Work</span><span>Project</span><span>Notes</span><span>Duration</span><span />
                        </div>
                        {sorted.map((w) => (
                            <div className="cw-worklog-row" key={w.id}>
                                <span>{to12h(w.start)} – {to12h(w.end)}</span>
                                <span><span className="cw-inline-edit" title="Click to edit" onClick={() => actions.openWorklogEditModal(w)}>{w.description}</span></span>
                                <span><span className="cw-chip">{w.project}</span></span>
                                <span className="cw-subtle-sm">{w.notes || "—"}</span>
                                <span>{formatDuration(w.duration)}</span>
                                <span className="cw-row-actions">
                                    <button className="cw-icon-btn cw-icon-btn-tiny" title="Edit" onClick={() => actions.openWorklogEditModal(w)}><Pencil size={14} /></button>
                                    <button className="cw-icon-btn cw-icon-btn-tiny" title="Delete" onClick={() => actions.deleteWorklog(w.id)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                        ))}
                        <div className="cw-worklog-total">
                            <span>TOTAL</span>
                            <strong>{formatDurationPadded(totalMinutes)}</strong>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* -------------------------------- Calendar page ------------------------------ */

function CalendarPage({ state, selectedDate, setSelectedDate, currentEmployee, setPage }) {
    const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    const activityIndex = useMemo(() => {
        const s = new Set();
        state.tasks.forEach((t) => { if (t.employeeId === currentEmployee.id) s.add(t.dateKey); });
        state.worklogs.forEach((w) => { if (w.employeeId === currentEmployee.id) s.add(w.dateKey); });
        return s;
    }, [state.tasks, state.worklogs, currentEmployee.id]);

    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

    const bsStart = toBS(first);
    const bsEnd = toBS(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), daysInMonth));
    const bsRangeLabel = bsStart.month === bsEnd.month
        ? `${bsStart.month} ${bsStart.day}–${bsEnd.day}, ${bsStart.year}`
        : `${bsStart.month} ${bsStart.day}, ${bsStart.year} – ${bsEnd.month} ${bsEnd.day}, ${bsEnd.year}`;

    const key = dateKey(selectedDate);
    const dayTasks = state.tasks.filter((t) => t.employeeId === currentEmployee.id && t.dateKey === key);
    const dayWorklogs = state.worklogs.filter((w) => w.employeeId === currentEmployee.id && w.dateKey === key);
    const daySummary = state.summaries[`${currentEmployee.id}__${key}`];

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">Calendar</h1>
                    <p className="cw-subtle">English (AD) and Bikram Sambat (BS) dates, side by side.</p>
                </div>
            </div>

            <div className="cw-calendar-layout">
                <div className="cw-panel cw-calendar-panel">
                    <div className="cw-calendar-head">
                        <div>
                            <h3>{formatMonthYear(viewMonth)}</h3>
                            <span className="cw-subtle-sm">Bikram Sambat: {bsRangeLabel}</span>
                        </div>
                        <div className="cw-minical-nav">
                            <button className="cw-btn-outline cw-btn-sm" onClick={() => { setViewMonth(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)); setSelectedDate(new Date(TODAY)); }}>Today</button>
                            <button className="cw-icon-btn" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                            <button className="cw-icon-btn" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="cw-cal-grid cw-cal-dow">
                        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => <span key={d}>{d}</span>)}
                    </div>
                    <div className="cw-cal-grid">
                        {cells.map((d, i) => {
                            if (!d) return <div className="cw-cal-cell empty" key={i} />;
                            const bs = toBS(d);
                            const isSel = sameDay(d, selectedDate);
                            const isToday = sameDay(d, TODAY);
                            const hasWork = activityIndex.has(dateKey(d));
                            return (
                                <button key={i} className={`cw-cal-cell ${isSel ? "sel" : ""} ${isToday && !isSel ? "today" : ""}`} onClick={() => setSelectedDate(d)}>
                                    <span className="cw-cal-ad">{d.getDate()}</span>
                                    <span className="cw-cal-bs">{bs.month.slice(0, 3)} {bs.day}</span>
                                    {hasWork && <span className="cw-minical-dot cw-cal-dot" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="cw-panel cw-cal-detail">
                    <h3>{formatLongDate(selectedDate)}</h3>
                    <div className="cw-subtle-sm" style={{ marginBottom: 16 }}>{formatBS(selectedDate)} BS</div>

                    <div className="cw-cal-detail-stat"><span>Tasks</span><strong>{dayTasks.length}</strong></div>
                    <div className="cw-cal-detail-stat"><span>Completed</span><strong>{dayTasks.filter((t) => t.status === "DONE").length}</strong></div>
                    <div className="cw-cal-detail-stat"><span>Worklog</span><strong>{formatDuration(dayWorklogs.reduce((s, w) => s + w.duration, 0))}</strong></div>
                    <div className="cw-cal-detail-stat">
                        <span>Day Summary</span>
                        <strong className={daySummary?.submitted ? "cw-text-green" : "cw-text-dim"}>{daySummary?.submitted ? "Submitted" : daySummary ? "Draft" : "Not started"}</strong>
                    </div>

                    <div className="cw-cal-actions">
                        <button className="cw-btn-outline cw-full" onClick={() => { setPage("tasks"); }}>
                            <ClipboardList size={14} /> View Tasks
                        </button>
                        <button className="cw-btn-outline cw-full" onClick={() => { setPage("worklog"); }}>
                            <Clock size={14} /> View Worklog
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* -------------------------------- Reports page ------------------------------ */

function ReportsPage({ state, actions, currentEmployee }) {
    const fileInputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState(null);
    const myReports = state.reports.filter((r) => r.employeeId === currentEmployee.id);

    const handleFiles = (fileList) => {
        Array.from(fileList).forEach((file) => actions.addReport(file, currentEmployee));
    };

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">Reports</h1>
                    <p className="cw-subtle">Store work documents, daily reports and supporting attachments.</p>
                </div>
            </div>

            <div
                className={`cw-upload-zone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload size={26} color="var(--red)" />
                <div className="cw-upload-title">Upload a work document</div>
                <div className="cw-upload-note">Drag and drop, or click to browse. DOC, DOCX, PDF, XLS, XLSX, PPT, PPTX, CSV, PNG, JPG.</div>
                <button className="cw-btn-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><Plus size={15} /> Upload File</button>
                <input ref={fileInputRef} type="file" multiple hidden accept=".doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.png,.jpg,.jpeg" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            </div>

            <div className="cw-panel">
                <div className="cw-panel-head"><h3>Documents</h3><span className="cw-subtle-sm">{myReports.length} files</span></div>
                {myReports.length === 0 ? (
                    <EmptyState icon={<FileIcon size={26} color="var(--text-dimmer)" />} title="No documents yet" note="Uploaded files will show up here." />
                ) : (
                    <div className="cw-reports-table">
                        <div className="cw-reports-row cw-reports-head">
                            <span>File</span><span>Type</span><span>Uploaded</span><span>Status</span><span>Actions</span>
                        </div>
                        {myReports.map((r) => (
                            <div className="cw-reports-row" key={r.id}>
                                <span className="cw-reports-file">{IconForFile(r.fileType)} {r.fileName}</span>
                                <span><span className="cw-chip">{r.fileType}</span></span>
                                <span className="cw-subtle-sm">{r.uploadedAt === dateKey(TODAY) ? "Today" : formatShortDate(new Date(r.uploadedAt))}</span>
                                <span><span className="cw-chip cw-chip-green">{r.status}</span></span>
                                <span className="cw-row-actions">
                                    <button className="cw-icon-btn cw-icon-btn-tiny" title="Preview" onClick={() => setPreview(r)}><Eye size={14} /></button>
                                    <a className="cw-icon-btn cw-icon-btn-tiny" title="Download" href={r.url || undefined} download={r.fileName} onClick={(e) => { if (!r.url) { e.preventDefault(); actions.toast("No downloadable copy for this sample file.", "error"); } }}><Download size={14} /></a>
                                    <button className="cw-icon-btn cw-icon-btn-tiny" title="Delete" onClick={() => actions.deleteReport(r.id)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {preview && (
                <Modal title={preview.fileName} onClose={() => setPreview(null)} width={620}>
                    {preview.url && preview.fileType.match(/PNG|JPG|JPEG/) ? (
                        <img src={preview.url} alt={preview.fileName} style={{ width: "100%", borderRadius: 10 }} />
                    ) : preview.url && preview.fileType === "PDF" ? (
                        <iframe title="pdf-preview" src={preview.url} style={{ width: "100%", height: 420, border: "none", borderRadius: 10 }} />
                    ) : (
                        <EmptyState icon={IconForFile(preview.fileType)} title="Preview not available" note="This is a sample record without an attached file." />
                    )}
                </Modal>
            )}
        </div>
    );
}

/* -------------------------------- Daily Summary page ------------------------------ */
/* Daily Summary is its own DEDICATED page. Not a side panel. */

function DailySummaryPage({ state, selectedDate, setSelectedDate, actions, currentEmployee }) {
    const key = dateKey(selectedDate);
    const summaryKey = `${currentEmployee.id}__${key}`;
    const summary = state.summaries[summaryKey] || { accomplishments: "", blockers: "", tomorrowPlan: "", submitted: false, submittedAt: null, managerReviewed: false, managerComment: "" };
    const [local, setLocal] = useState(summary);
    const isToday = sameDay(selectedDate, TODAY);

    useEffect(() => {
        const s = state.summaries[summaryKey] || { accomplishments: "", blockers: "", tomorrowPlan: "", submitted: false, submittedAt: null, managerReviewed: false, managerComment: "" };
        setLocal(s);
    }, [summaryKey, state.summaries]);

    const update = (field, value) => {
        const next = { ...local, [field]: value };
        setLocal(next);
    };

    const saveDraft = () => {
        actions.saveSummary(currentEmployee.id, key, {
            accomplishments: local.accomplishments,
            blockers: local.blockers,
            tomorrowPlan: local.tomorrowPlan,
        });
        actions.toast("Draft saved.", "success");
    };

    const submitSummary = () => {
        if (!local.accomplishments.trim() || !local.blockers.trim() || !local.tomorrowPlan.trim()) {
            actions.toast("Please fill all fields before submitting.", "error");
            return;
        }
        actions.saveSummary(currentEmployee.id, key, {
            accomplishments: local.accomplishments,
            blockers: local.blockers,
            tomorrowPlan: local.tomorrowPlan,
        });
        actions.submitSummary(currentEmployee.id, key);
    };

    const reopenSummary = () => {
        actions.saveSummary(currentEmployee.id, key, { submitted: false, submittedAt: null });
    };

    // Historical summaries for the current employee
    const allSummaryKeys = Object.keys(state.summaries).filter((k) => k.startsWith(currentEmployee.id + "__")).sort().reverse();

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">Daily Summary</h1>
                    <p className="cw-subtle">{isToday ? "Submit your official daily work record." : `Viewing summary for ${formatShortDate(selectedDate)}.`}</p>
                </div>
                <DateNav selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            </div>

            <div className="cw-summary-layout">
                <div className="cw-panel cw-summary-form">
                    <div className="cw-panel-head">
                        <h3>{formatLongDate(selectedDate)}</h3>
                        {summary.submitted && (
                            <span className="cw-submitted-badge"><CheckCircle2 size={15} color="var(--green)" /> Submitted at {summary.submittedAt}</span>
                        )}
                    </div>

                    <label className="cw-field-label">What did you accomplish today?</label>
                    <textarea className="cw-textarea" rows={4} disabled={summary.submitted} value={local.accomplishments} onChange={(e) => update("accomplishments", e.target.value)} placeholder="Summarize what got done today…" />

                    <label className="cw-field-label">What blockers / challenges did you face?</label>
                    <textarea className="cw-textarea" rows={3} disabled={summary.submitted} value={local.blockers} onChange={(e) => update("blockers", e.target.value)} placeholder="Anything slowing you down?" />

                    <label className="cw-field-label">What is your plan for tomorrow?</label>
                    <textarea className="cw-textarea" rows={3} disabled={summary.submitted} value={local.tomorrowPlan} onChange={(e) => update("tomorrowPlan", e.target.value)} placeholder="What's next?" />

                    {summary.managerReviewed && summary.managerComment && (
                        <div className="cw-manager-review">
                            <label className="cw-field-label">Manager Feedback</label>
                            <p className="cw-readonly-text">{summary.managerComment}</p>
                        </div>
                    )}

                    <div className="cw-summary-actions">
                        {summary.submitted ? (
                            <button className="cw-btn-outline cw-full" onClick={reopenSummary}>Reopen &amp; Edit</button>
                        ) : (
                            <>
                                <button className="cw-btn-outline" onClick={saveDraft}>Save Draft</button>
                                <button className="cw-btn-primary" onClick={submitSummary} disabled={!local.accomplishments.trim() || !local.blockers.trim() || !local.tomorrowPlan.trim()}><Send size={15} /> Submit Summary</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="cw-panel cw-summary-history">
                    <h3 style={{ marginBottom: 12 }}>History</h3>
                    {allSummaryKeys.length === 0 ? (
                        <EmptyState icon={<FileText size={22} color="var(--text-dimmer)" />} title="No summaries yet" />
                    ) : (
                        <div className="cw-history-list">
                            {allSummaryKeys.slice(0, 14).map((sk) => {
                                const dk = sk.split("__")[1];
                                const s = state.summaries[sk];
                                const d = new Date(dk);
                                const isCurrent = dk === key;
                                return (
                                    <button key={sk} className={`cw-history-item ${isCurrent ? "active" : ""}`} onClick={() => setSelectedDate(d)}>
                                        <span>{formatShortDate(d)}</span>
                                        <span className={`cw-chip ${s.submitted ? "cw-chip-green" : s.accomplishments ? "cw-chip-blue" : "cw-chip-red"}`}>
                                            {s.submitted ? "Submitted" : s.accomplishments ? "Draft" : "Empty"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* -------------------------------- Management page ------------------------------ */
/* Management is MANAGER ONLY. Employees must NOT see this page. */

function ManagementPage({ state, selectedDate, setSelectedDate, currentEmployee, actions }) {
    const key = dateKey(selectedDate);
    const [viewEmployee, setViewEmployee] = useState(null);
    const [viewTab, setViewTab] = useState("overview");

    const teamEmployees = EMPLOYEES.filter((e) => e.id !== currentEmployee.id);

    const rows = teamEmployees.map((emp) => {
        const tasks = state.tasks.filter((t) => t.employeeId === emp.id && t.dateKey === key);
        const worklogs = state.worklogs.filter((w) => w.employeeId === emp.id && w.dateKey === key);
        const summary = state.summaries[`${emp.id}__${key}`];
        return {
            emp,
            tasksTotal: tasks.length,
            tasksDone: tasks.filter((t) => t.status === "DONE").length,
            worklogMinutes: worklogs.reduce((s, w) => s + w.duration, 0),
            summary,
            tasks,
            worklogs,
        };
    });

    const totalEmployees = teamEmployees.length;
    const totalDone = rows.reduce((s, r) => s + r.tasksDone, 0);
    const totalTasks = rows.reduce((s, r) => s + r.tasksTotal, 0);
    const submittedCount = rows.filter((r) => r.summary?.submitted).length;
    const needsAttention = rows.filter((r) => !r.summary?.submitted).length;

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">Management</h1>
                    <p className="cw-subtle">Overview of authorized employee records.</p>
                </div>
                <DateNav selectedDate={selectedDate} setSelectedDate={setSelectedDate} showAddTask={false} />
            </div>

            <div className="cw-stat-grid">
                <StatCard icon={<Users size={20} />} tone="blue" label="EMPLOYEES" value={String(totalEmployees).padStart(2, "0")} note="On the team" />
                <StatCard icon={<CheckCircle2 size={20} />} tone="green" label="TASKS COMPLETED" value={`${totalDone} / ${totalTasks}`} note="Today" />
                <StatCard icon={<Send size={20} />} tone="purple" label="SUMMARIES SUBMITTED" value={String(submittedCount).padStart(2, "0")} note="Today" />
                <StatCard icon={<AlertTriangle size={20} />} tone="red" label="NEEDS ATTENTION" value={String(needsAttention).padStart(2, "0")} note="Missing summary" />
            </div>

            <div className="cw-panel">
                <div className="cw-panel-head"><h3>Team Overview</h3></div>
                <div className="cw-team-table">
                    <div className="cw-team-row cw-team-head">
                        <span>Employee</span><span>Tasks</span><span>Progress</span><span>Worklog</span><span>Daily Summary</span><span>Action</span>
                    </div>
                    {rows.map(({ emp, tasksTotal, tasksDone, worklogMinutes, summary }) => {
                        const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
                        const status = !summary || (!summary.submitted && !summary.accomplishments) ? "Missing" : summary.submitted ? "Submitted" : "Draft";
                        return (
                            <div className="cw-team-row" key={emp.id}>
                                <span className="cw-team-emp"><Avatar name={emp.name} size={32} /><span><div>{emp.name}</div><div className="cw-subtle-sm">{emp.designation}</div></span></span>
                                <span>{tasksTotal} tasks</span>
                                <span>{pct}%</span>
                                <span>{formatDuration(worklogMinutes)}</span>
                                <span><span className={`cw-chip ${status === "Submitted" ? "cw-chip-green" : status === "Draft" ? "cw-chip-blue" : "cw-chip-red"}`}>{status}</span></span>
                                <span>
                                    {status === "Missing" ? (
                                        <button className="cw-btn-outline cw-btn-sm" onClick={() => actions.toast(`Follow-up reminder sent to ${emp.name.split(" ")[0]}.`, "success")}>Follow up</button>
                                    ) : (
                                        <button className="cw-btn-outline cw-btn-sm" onClick={() => { setViewEmployee(rows.find((r) => r.emp.id === emp.id)); setViewTab("overview"); }}>View</button>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {viewEmployee && (
                <Modal title={viewEmployee.emp.name} onClose={() => setViewEmployee(null)} width={620}>
                    <div className="cw-subtle-sm" style={{ marginBottom: 14 }}>{viewEmployee.emp.designation} · {viewEmployee.emp.department} · {formatShortDate(selectedDate)}</div>

                    <div className="cw-mgmt-tabs">
                        {["overview", "tasks", "worklog", "summary", "reports"].map((t) => (
                            <button key={t} className={`cw-mgmt-tab ${viewTab === t ? "active" : ""}`} onClick={() => setViewTab(t)}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    {viewTab === "overview" && (
                        <>
                            <div className="cw-cal-detail-stat"><span>Tasks</span><strong>{viewEmployee.tasksTotal}</strong></div>
                            <div className="cw-cal-detail-stat"><span>Completed</span><strong>{viewEmployee.tasksDone}</strong></div>
                            <div className="cw-cal-detail-stat"><span>Worklog</span><strong>{formatDuration(viewEmployee.worklogMinutes)}</strong></div>
                            <div className="cw-cal-detail-stat"><span>Summary</span><strong>{viewEmployee.summary?.submitted ? "Submitted" : "Not submitted"}</strong></div>
                        </>
                    )}

                    {viewTab === "tasks" && (
                        <div className="cw-mgmt-list">
                            {viewEmployee.tasks.length === 0 ? (
                                <EmptyState icon={<ClipboardList size={20} color="var(--text-dimmer)" />} title="No tasks for today" />
                            ) : viewEmployee.tasks.map((t) => (
                                <div className="cw-mgmt-list-item" key={t.id}>
                                    <StatusPill status={t.status} />
                                    <span>{t.title}</span>
                                    <PriorityTag priority={t.priority} />
                                </div>
                            ))}
                        </div>
                    )}

                    {viewTab === "worklog" && (
                        <div className="cw-mgmt-list">
                            {viewEmployee.worklogs.length === 0 ? (
                                <EmptyState icon={<Clock size={20} color="var(--text-dimmer)" />} title="No worklog for today" />
                            ) : viewEmployee.worklogs.map((w) => (
                                <div className="cw-mgmt-list-item" key={w.id}>
                                    <span className="cw-subtle-sm">{to12h(w.start)} – {to12h(w.end)}</span>
                                    <span>{w.description}</span>
                                    <span className="cw-subtle-sm">{formatDuration(w.duration)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewTab === "summary" && (
                        <>
                            {viewEmployee.summary?.accomplishments ? (
                                <>
                                    <label className="cw-field-label">Accomplishments</label>
                                    <p className="cw-readonly-text">{viewEmployee.summary.accomplishments}</p>
                                </>
                            ) : null}
                            {viewEmployee.summary?.blockers ? (
                                <>
                                    <label className="cw-field-label">Blockers</label>
                                    <p className="cw-readonly-text">{viewEmployee.summary.blockers}</p>
                                </>
                            ) : null}
                            {viewEmployee.summary?.tomorrowPlan ? (
                                <>
                                    <label className="cw-field-label">Plan for Tomorrow</label>
                                    <p className="cw-readonly-text">{viewEmployee.summary.tomorrowPlan}</p>
                                </>
                            ) : null}
                            {!viewEmployee.summary?.accomplishments && !viewEmployee.summary?.blockers && (
                                <EmptyState icon={<FileText size={20} color="var(--text-dimmer)" />} title="No summary content" />
                            )}
                        </>
                    )}

                    {viewTab === "reports" && (
                        <div className="cw-mgmt-list">
                            {state.reports.filter(r => r.employeeId === viewEmployee.emp.id).length === 0 ? (
                                <EmptyState icon={<FileIcon size={20} color="var(--text-dimmer)" />} title="No reports uploaded" />
                            ) : state.reports.filter(r => r.employeeId === viewEmployee.emp.id).map((r) => (
                                <div className="cw-mgmt-list-item" key={r.id}>
                                    <span style={{ flex: 1 }}>{r.fileName}</span>
                                    <span className="cw-subtle-sm">{r.fileSize}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}

function StatCard({ icon, tone, label, value, note }) {
    return (
        <div className="cw-stat-card">
            <div className={`cw-stat-icon cw-tone-${tone}`}>{icon}</div>
            <div>
                <div className="cw-stat-label">{label}</div>
                <div className="cw-stat-value">{value}</div>
                <div className="cw-stat-note">{note}</div>
            </div>
        </div>
    );
}

/* -------------------------------- Settings page ------------------------------ */

function SettingsPage({ currentEmployee, actions, userSettings, setUserSettings }) {
    const [name, setName] = useState(currentEmployee.name);
    const [designation, setDesignation] = useState(currentEmployee.designation);
    const [department, setDepartment] = useState(currentEmployee.department || "");
    const [email, setEmail] = useState(userSettings.email || `${currentEmployee.id}@bizz.com`);
    const [taskReminders, setTaskReminders] = useState(userSettings.taskReminders !== false);
    const [worklogReminders, setWorklogReminders] = useState(userSettings.worklogReminders !== false);
    const [summaryReminders, setSummaryReminders] = useState(userSettings.summaryReminders !== false);
    const [defaultProject, setDefaultProject] = useState(userSettings.defaultProject || PROJECTS[0]);

    const save = () => {
        setUserSettings({
            ...userSettings,
            email,
            taskReminders,
            worklogReminders,
            summaryReminders,
            defaultProject,
        });
        actions.toast("Settings saved.", "success");
    };

    return (
        <div className="cw-page">
            <div className="cw-page-head">
                <div>
                    <h1 className="cw-page-title">Settings</h1>
                    <p className="cw-subtle">Your profile and preferences.</p>
                </div>
            </div>

            <div className="cw-settings-grid">
                <div className="cw-panel">
                    <div className="cw-panel-head"><h3><User size={16} /> Profile</h3></div>
                    <label className="cw-field-label">Full name</label>
                    <input className="cw-input" value={name} onChange={(e) => setName(e.target.value)} />
                    <label className="cw-field-label">Email</label>
                    <input className="cw-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <label className="cw-field-label">Designation</label>
                    <input className="cw-input" value={designation} onChange={(e) => setDesignation(e.target.value)} />
                    <label className="cw-field-label">Department</label>
                    <input className="cw-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>

                <div className="cw-panel">
                    <div className="cw-panel-head"><h3><Palette size={16} /> Preferences</h3></div>
                    <label className="cw-field-label">Default project</label>
                    <select className="cw-input" value={defaultProject} onChange={(e) => setDefaultProject(e.target.value)}>
                        {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <div className="cw-panel-head" style={{ marginTop: 24 }}><h3><BellRing size={16} /> Notifications</h3></div>
                    <label className="cw-field-label cw-row-between">
                        <span>Task due reminders</span>
                        <input type="checkbox" className="cw-toggle" checked={taskReminders} onChange={(e) => setTaskReminders(e.target.checked)} />
                    </label>
                    <label className="cw-field-label cw-row-between">
                        <span>Daily worklog reminder</span>
                        <input type="checkbox" className="cw-toggle" checked={worklogReminders} onChange={(e) => setWorklogReminders(e.target.checked)} />
                    </label>
                    <label className="cw-field-label cw-row-between">
                        <span>Daily summary reminders</span>
                        <input type="checkbox" className="cw-toggle" checked={summaryReminders} onChange={(e) => setSummaryReminders(e.target.checked)} />
                    </label>
                </div>
            </div>

            <button className="cw-btn-primary" style={{ marginTop: 20 }} onClick={save}>Save Changes</button>
        </div>
    );
}

/* -------------------------------- Task Modal ------------------------------ */

function TaskModal({ task, defaultStatus, defaultDate, onClose, onSave, onDelete }) {
    const [form, setForm] = useState(() => task ? { ...task } : {
        title: "", description: "", status: defaultStatus || "TODO", priority: "Normal",
        dueDate: defaultDate || dateKey(TODAY), project: PROJECTS[0],
    });

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const submit = () => {
        if (!form.title.trim()) return;
        onSave(form);
    };

    return (
        <Modal title={task ? "Edit Task" : "Add Task"} onClose={onClose} width={520}>
            <label className="cw-field-label">Title</label>
            <input className="cw-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Prepare client proposal" autoFocus />

            <label className="cw-field-label">Description</label>
            <textarea className="cw-textarea" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Add details…" />

            <div className="cw-form-row">
                <div>
                    <label className="cw-field-label">Status</label>
                    <select className="cw-input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                </div>
                <div>
                    <label className="cw-field-label">Priority</label>
                    <select className="cw-input" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div className="cw-form-row">
                <div>
                    <label className="cw-field-label">Project</label>
                    <select className="cw-input" value={form.project} onChange={(e) => set("project", e.target.value)}>
                        {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div>
                    <label className="cw-field-label">Due date</label>
                    <input className="cw-input" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
                </div>
            </div>

            <div className="cw-modal-actions">
                {task && <button className="cw-btn-outline cw-danger" onClick={() => { onDelete(task.id); onClose(); }}><Trash2 size={14} /> Delete</button>}
                <div style={{ flex: 1 }} />
                <button className="cw-btn-outline" onClick={onClose}>Cancel</button>
                <button className="cw-btn-primary" onClick={submit}>{task ? "Save Changes" : "Add Task"}</button>
            </div>
        </Modal>
    );
}

/* -------------------------------- Worklog Modal ------------------------------ */

function WorklogModal({ worklog, dateKeyValue, tasksForDay, onClose, onSave }) {
    const isEdit = !!worklog;
    const [description, setDescription] = useState(isEdit ? worklog.description : (tasksForDay[0]?.title || ""));
    const [taskId, setTaskId] = useState(isEdit ? (worklog.taskId || "") : (tasksForDay[0]?.id || ""));
    const [project, setProject] = useState(isEdit ? worklog.project : (tasksForDay[0]?.project || PROJECTS[0]));
    const [start, setStart] = useState(isEdit ? worklog.start : "09:00");
    const [end, setEnd] = useState(isEdit ? worklog.end : "10:00");
    const [notes, setNotes] = useState(isEdit ? (worklog.notes || "") : "");

    const duration = minutesBetween(start, end);
    const valid = description.trim() && duration > 0;

    return (
        <Modal title={isEdit ? "Edit Worklog" : "Add Worklog"} onClose={onClose} width={480}>
            <label className="cw-field-label">Work / task</label>
            {tasksForDay.length > 0 && !isEdit ? (
                <select className="cw-input" value={taskId} onChange={(e) => { const t = tasksForDay.find((x) => x.id === e.target.value); setTaskId(e.target.value); if (t) { setDescription(t.title); setProject(t.project); } }}>
                    {tasksForDay.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    <option value="">Other…</option>
                </select>
            ) : null}
            {(tasksForDay.length === 0 || taskId === "" || isEdit) && (
                <input className="cw-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you work on?" />
            )}

            <div className="cw-form-row">
                <div>
                    <label className="cw-field-label">Start time</label>
                    <input className="cw-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                    <label className="cw-field-label">End time</label>
                    <input className="cw-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
            </div>

            <label className="cw-field-label">Project / category</label>
            <select className="cw-input" value={project} onChange={(e) => setProject(e.target.value)}>
                {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <label className="cw-field-label">Notes</label>
            <textarea className="cw-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />

            <div className="cw-duration-preview">Duration: <strong>{duration > 0 ? formatDuration(duration) : "—"}</strong>{duration <= 0 && <span className="cw-text-red"> · end must be after start</span>}</div>

            <div className="cw-modal-actions">
                <div style={{ flex: 1 }} />
                <button className="cw-btn-outline" onClick={onClose}>Cancel</button>
                <button className="cw-btn-primary" disabled={!valid} onClick={() => valid && onSave({ id: isEdit ? worklog.id : null, taskId: taskId || null, description, project, start, end, notes, duration })}>{isEdit ? "Save Changes" : "Add Worklog"}</button>
            </div>
        </Modal>
    );
}

/* -------------------------------- Mobile Bottom Nav ------------------------------ */

function MobileBottomNav({ page, setPage, isManager }) {
    const items = [
        { id: "dashboard", label: "Home", icon: Home },
        { id: "tasks", label: "Tasks", icon: ClipboardList },
        { id: "worklog", label: "Worklog", icon: Clock },
        { id: "calendar", label: "Calendar", icon: CalendarIcon },
        { id: "more", label: "More", icon: MoreHorizontal },
    ];

    const [moreOpen, setMoreOpen] = useState(false);

    const moreItems = [
        { id: "reports", label: "Reports", icon: FolderOpen },
        { id: "summary", label: "Daily Summary", icon: FileText },
        ...(isManager ? [{ id: "management", label: "Management", icon: Users }] : []),
        { id: "settings", label: "Settings", icon: SettingsIcon },
    ];

    const isActive = (id) => {
        if (id === "more") return moreItems.some((m) => m.id === page);
        return page === id;
    };

    return (
        <>
            {moreOpen && <div className="cw-more-overlay" onClick={() => setMoreOpen(false)} />}
            {moreOpen && (
                <div className="cw-more-menu">
                    {moreItems.map((it) => (
                        <button key={it.id} className={`cw-more-item ${page === it.id ? "active" : ""}`} onClick={() => { setPage(it.id); setMoreOpen(false); }}>
                            <it.icon size={18} />
                            <span>{it.label}</span>
                        </button>
                    ))}
                </div>
            )}
            <nav className="cw-bottom-nav">
                {items.map((it) => (
                    <button
                        key={it.id}
                        className={`cw-bottom-nav-item ${isActive(it.id) ? "active" : ""}`}
                        onClick={() => {
                            if (it.id === "more") { setMoreOpen((v) => !v); }
                            else { setPage(it.id); setMoreOpen(false); }
                        }}
                    >
                        <it.icon size={20} />
                        <span>{it.label}</span>
                    </button>
                ))}
            </nav>
        </>
    );
}

/* -------------------------------- Role Switcher ------------------------------ */
/* For prototype testing only. Allows switching between Employee and Manager views. */

function RoleSwitcher({ currentEmployeeId, setCurrentEmployeeId }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="cw-role-switcher">
            <button className="cw-role-switch-btn" onClick={() => setOpen((v) => !v)}>
                <Shield size={14} /> Switch Role
            </button>
            {open && (
                <div className="cw-role-menu">
                    <div className="cw-role-menu-title">Select User (Prototype)</div>
                    {EMPLOYEES.map((e) => (
                        <button
                            key={e.id}
                            className={`cw-role-menu-item ${currentEmployeeId === e.id ? "active" : ""}`}
                            onClick={() => { setCurrentEmployeeId(e.id); setOpen(false); }}
                        >
                            <Avatar name={e.name} size={28} />
                            <div>
                                <div style={{ fontWeight: 600 }}>{e.name}</div>
                                <div className="cw-subtle-sm">{e.designation} · {e.role}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ------------------------------------ App ---------------------------------- */

export default function App() {
    // Load persisted state from localStorage
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.tasks && parsed.worklogs) return parsed;
            }
        } catch (e) { /* ignore parse errors */ }
        return buildInitialData();
    });

    const [currentEmployeeId, setCurrentEmployeeId] = useState(() => {
        try {
            return localStorage.getItem("bizz_current_user") || "jeewan";
        } catch { return "jeewan"; }
    });

    const [page, setPage] = useState("dashboard");
    const [selectedDate, setSelectedDate] = useState(new Date(TODAY));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [taskModal, setTaskModal] = useState(null);
    const [worklogModal, setWorklogModal] = useState(null); // { dateKey } or { worklog }
    const [toasts, setToasts] = useState([]);
    const [userSettings, setUserSettings] = useState(() => {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return { taskReminders: true, summaryReminders: true, defaultProject: PROJECTS[0], email: "" };
    });

    const currentEmployee = EMPLOYEES.find((e) => e.id === currentEmployeeId) || EMPLOYEES[0];

    // Persist state to localStorage
    useEffect(() => {
        try {
            const toSave = { ...state };
            // Don't save blob URLs for reports (they're session-only)
            toSave.reports = toSave.reports.map((r) => ({ ...r, url: null }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch { /* quota exceeded or other error */ }
    }, [state]);

    // Persist current user selection
    useEffect(() => {
        localStorage.setItem("bizz_current_user", currentEmployeeId);
    }, [currentEmployeeId]);

    // Persist settings
    useEffect(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
    }, [userSettings]);

    // If employee switches to a non-manager and is on management page, redirect
    useEffect(() => {
        if (page === "management" && currentEmployee.role !== "manager") {
            setPage("dashboard");
        }
    }, [currentEmployee.role, page]);

    const toast = useCallback((message, type = "success") => {
        const id = uid("toast");
        setToasts((t) => [...t, { id, message, type }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    }, []);

    const actions = {
        toast,
        openTaskModal: (task, defaultStatus, defaultDate) => setTaskModal({ task, defaultStatus, defaultDate }),
        openWorklogModal: (dk) => setWorklogModal({ dateKeyValue: dk }),
        openWorklogEditModal: (worklog) => setWorklogModal({ worklog }),
        saveSummary: (employeeId, dk, patch) => {
            setState((s) => ({ ...s, summaries: { ...s.summaries, [`${employeeId}__${dk}`]: { ...(s.summaries[`${employeeId}__${dk}`] || { accomplishments: "", blockers: "", tomorrowPlan: "", submitted: false, submittedAt: null, managerReviewed: false, managerComment: "" }), ...patch } } }));
        },
        submitSummary: (employeeId, dk) => {
            const now = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" });
            setState((s) => ({ ...s, summaries: { ...s.summaries, [`${employeeId}__${dk}`]: { ...(s.summaries[`${employeeId}__${dk}`] || {}), submitted: true, submittedAt: now } } }));
            toast("Daily summary submitted.", "success");
        },
        moveTask: (taskId, status) => {
            setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === taskId ? { ...t, status, completedAt: status === "DONE" ? new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" }) : null } : t) }));
        },
        deleteTask: (taskId) => {
            if (!window.confirm("Delete this task? This can't be undone.")) return;
            setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }));
            toast("Task deleted.", "success");
        },
        deleteWorklog: (id) => {
            setState((s) => ({ ...s, worklogs: s.worklogs.filter((w) => w.id !== id) }));
            toast("Worklog entry deleted.", "success");
        },
        addReport: (file, employee) => {
            const ext = file.name.split(".").pop().toUpperCase();
            const url = (typeof URL !== "undefined" && URL.createObjectURL) ? URL.createObjectURL(file) : null;
            const sizeKB = Math.max(1, Math.round(file.size / 1024));
            const size = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
            setState((s) => ({ ...s, reports: [{ id: uid("r"), employeeId: employee.id, fileName: file.name, fileType: ext, fileSize: size, uploadedAt: dateKey(TODAY), uploadedBy: employee.name, status: "Stored", storageType: "local-prototype", url }, ...s.reports] }));
            toast(`${file.name} uploaded.`, "success");
        },
        deleteReport: (id) => {
            setState((s) => {
                const r = s.reports.find((x) => x.id === id);
                if (r?.url) URL.revokeObjectURL(r.url);
                return { ...s, reports: s.reports.filter((x) => x.id !== id) };
            });
            toast("Document deleted.", "success");
        },
    };

    const saveTask = (form) => {
        setState((s) => {
            if (form.id) {
                return { ...s, tasks: s.tasks.map((t) => t.id === form.id ? { ...t, ...form } : t) };
            }
            const newTask = { ...form, id: uid("t"), employeeId: currentEmployee.id, dateKey: dateKey(selectedDate), createdAt: Date.now(), completedAt: form.status === "DONE" ? new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" }) : null, comments: [] };
            return { ...s, tasks: [...s.tasks, newTask] };
        });
        toast(taskModal?.task ? "Task updated." : "Task added.", "success");
        setTaskModal(null);
    };

    const saveWorklog = (form) => {
        if (form.id) {
            // Edit existing worklog
            setState((s) => ({ ...s, worklogs: s.worklogs.map((w) => w.id === form.id ? { ...w, ...form } : w) }));
            toast("Worklog updated.", "success");
        } else {
            // Add new worklog
            const dk = worklogModal.dateKeyValue || dateKey(selectedDate);
            setState((s) => ({ ...s, worklogs: [...s.worklogs, { ...form, id: uid("w"), employeeId: currentEmployee.id, dateKey: dk }] }));
            toast("Worklog added.", "success");
        }
        setWorklogModal(null);
    };

    return (
        <div className="cw-app">
            <GlobalStyles />
            <Sidebar page={page} setPage={setPage} currentEmployee={currentEmployee} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

            <div className="cw-mobile-topbar">
                <button className="cw-icon-btn" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
                <BizzLogo size={28} />
                <span className="cw-logo-title" style={{ fontSize: 16 }}>Bizz Workboard</span>
            </div>

            <main className="cw-main">
                {page === "dashboard" && <Dashboard state={state} currentEmployee={currentEmployee} />}
                {page === "tasks" && <MyTasksPage state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} actions={actions} currentEmployee={currentEmployee} />}
                {page === "worklog" && <WorklogPage state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} actions={actions} currentEmployee={currentEmployee} />}
                {page === "calendar" && <CalendarPage state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} currentEmployee={currentEmployee} setPage={setPage} />}
                {page === "reports" && <ReportsPage state={state} actions={actions} currentEmployee={currentEmployee} />}
                {page === "summary" && <DailySummaryPage state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} actions={actions} currentEmployee={currentEmployee} />}
                {page === "management" && currentEmployee.role === "manager" && <ManagementPage state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} currentEmployee={currentEmployee} actions={actions} />}
                {page === "settings" && <SettingsPage currentEmployee={currentEmployee} actions={actions} userSettings={userSettings} setUserSettings={setUserSettings} />}
            </main>

            <MobileBottomNav page={page} setPage={setPage} isManager={currentEmployee.role === "manager"} />
            <RoleSwitcher currentEmployeeId={currentEmployeeId} setCurrentEmployeeId={setCurrentEmployeeId} />

            {taskModal && (
                <TaskModal
                    task={taskModal.task}
                    defaultStatus={taskModal.defaultStatus}
                    defaultDate={taskModal.defaultDate}
                    onClose={() => setTaskModal(null)}
                    onSave={saveTask}
                    onDelete={actions.deleteTask}
                />
            )}

            {worklogModal && (
                <WorklogModal
                    worklog={worklogModal.worklog || null}
                    dateKeyValue={worklogModal.dateKeyValue || dateKey(selectedDate)}
                    tasksForDay={state.tasks.filter((t) => t.employeeId === currentEmployee.id && t.dateKey === (worklogModal.dateKeyValue || dateKey(selectedDate)))}
                    onClose={() => setWorklogModal(null)}
                    onSave={saveWorklog}
                />
            )}

            <ToastStack toasts={toasts} />
        </div>
    );
}

/* ------------------------------------ styles -------------------------------- */

function GlobalStyles() {
    return (
        <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .cw-app {
        --bg: #080b16;
        --bg-2: #0b1020;
        --panel: rgba(255,255,255,0.035);
        --panel-border: rgba(255,255,255,0.08);
        --panel-solid: #10152a;
        --text: #f4f5f9;
        --text-dim: #8a92ab;
        --text-dimmer: #565f79;
        --red: #e8483f;
        --red-soft: rgba(232,72,63,0.16);
        --blue: #4c7dff;
        --blue-soft: rgba(76,125,255,0.16);
        --green: #22c55e;
        --green-soft: rgba(34,197,94,0.16);
        --purple: #8b6bf2;
        --purple-soft: rgba(139,107,242,0.16);
        --radius: 16px;
        --radius-sm: 10px;
        font-family: 'Inter', sans-serif;
        color: var(--text);
        background: radial-gradient(1100px 700px at 100% 100%, rgba(76,125,255,0.10), transparent 60%),
                    radial-gradient(900px 600px at 0% 100%, rgba(232,72,63,0.14), transparent 55%),
                    var(--bg);
        min-height: 100vh;
        width: 100%;
        display: flex;
        position: relative;
      }
      .cw-app h1, .cw-app h2, .cw-app h3 { font-family: 'Manrope', sans-serif; margin: 0; color: var(--text); }
      .cw-app button, .cw-app input, .cw-app select, .cw-app textarea { font-family: 'Inter', sans-serif; }
      .cw-app button { cursor: pointer; }
      .cw-app ::-webkit-scrollbar { width: 8px; height: 8px; }
      .cw-app ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }

      /* Bizz Logo */
      .cw-bizz-logo {
        border-radius: 10px; background: linear-gradient(135deg, var(--red), #c03530); color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Manrope', sans-serif; font-weight: 800; flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(232,72,63,0.3);
      }

      /* Sidebar */
      .cw-sidebar {
        width: 248px; flex-shrink: 0; min-height: 100vh; padding: 22px 16px;
        display: flex; flex-direction: column; gap: 6px;
        border-right: 1px solid var(--panel-border);
        background: rgba(255,255,255,0.015);
      }
      .cw-logo-row { display: flex; align-items: center; gap: 10px; padding: 6px 10px 22px; }
      .cw-logo-title { font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 18px; }
      .cw-logo-sub { font-size: 11.5px; color: var(--text-dim); margin-top: -2px; }
      .cw-nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
      .cw-nav-item {
        display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--radius-sm);
        background: transparent; border: none; color: var(--text-dim); font-size: 14px; font-weight: 600; text-align: left;
        transition: background .15s, color .15s;
      }
      .cw-nav-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
      .cw-nav-item.active { background: linear-gradient(135deg, rgba(232,72,63,0.9), rgba(200,53,45,0.85)); color: #fff; box-shadow: 0 6px 18px rgba(232,72,63,0.25); }
      .cw-nav-badge { margin-left: auto; background: var(--red); color: #fff; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 20px; }
      .cw-nav-divider { height: 1px; background: var(--panel-border); margin: 10px 4px; }
      .cw-sidebar-profile { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--radius-sm); background: var(--panel); border: 1px solid var(--panel-border); margin-top: 8px; }
      .cw-profile-name { font-size: 13.5px; font-weight: 700; }
      .cw-profile-role { font-size: 11.5px; color: var(--text-dim); }
      .cw-role-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: var(--purple); background: var(--purple-soft); padding: 2px 8px; border-radius: 20px; }
      .cw-sidebar-scrim { display: none; }
      .cw-live-clock { display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); border-radius: 8px; padding: 8px; color: var(--text); font-size: 13px; font-weight: 600; font-family: 'Inter', monospace; }

      .cw-avatar { border-radius: 50%; background: linear-gradient(135deg, var(--blue), #7aa0ff); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }

      .cw-mobile-topbar { display: none; }

      /* Main */
      .cw-main { flex: 1; width: 100%; padding: 28px 34px 60px; min-width: 0; overflow-x: hidden; }
      .cw-page { display: flex; width: 100%; flex-direction: column; gap: 22px; }
      .cw-page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
      .cw-page-title { font-size: 28px; font-weight: 800; }
      .cw-hello { font-size: 17px; font-weight: 600; color: var(--text-dim); margin-bottom: 4px; }
      .cw-date-title { font-size: 30px; font-weight: 800; margin-bottom: 6px; }
      .cw-subtle { color: var(--text-dim); font-size: 14px; margin: 0; }
      .cw-subtle-sm { color: var(--text-dim); font-size: 12.5px; }
      .cw-text-dim { color: var(--text-dim); }
      .cw-text-green { color: var(--green); }
      .cw-text-red { color: var(--red); }

      /* Date nav */
      .cw-date-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .cw-pill-btn { display: flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--panel-border); color: var(--text); padding: 9px 12px; border-radius: 12px; font-size: 13.5px; font-weight: 600; }
      .cw-pill-btn:hover { background: rgba(255,255,255,0.07); }
      .cw-pill-btn-wide.is-today { border-color: rgba(232,72,63,0.4); }
      .cw-btn-primary { display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg, var(--red), var(--red)); border: 1px solid rgba(255,255,255,0.08); color: #fff; padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; box-shadow: 0 8px 20px rgba(232,72,63,0.28); transition: transform .1s, box-shadow .15s; }
      .cw-btn-primary:hover { box-shadow: 0 10px 26px rgba(232,72,63,0.38); }
      .cw-btn-primary:active { transform: scale(0.98); }
      .cw-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
      .cw-btn-primary.cw-full, .cw-btn-outline.cw-full { width: 100%; justify-content: center; }
      .cw-btn-outline { display: flex; align-items: center; gap: 6px; background: transparent; border: 1px solid var(--panel-border); color: var(--text); padding: 9px 14px; border-radius: 12px; font-size: 13px; font-weight: 600; }
      .cw-btn-outline:hover { background: rgba(255,255,255,0.05); }
      .cw-btn-outline.cw-danger { border-color: rgba(232,72,63,0.35); color: var(--red); }
      .cw-btn-sm { padding: 6px 10px; font-size: 12px; border-radius: 9px; }
      .cw-icon-btn { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 12px; background: var(--panel); border: 1px solid var(--panel-border); color: var(--text); }
      .cw-icon-btn:hover { background: rgba(255,255,255,0.08); }
      .cw-icon-btn-tiny { width: 26px; height: 26px; border-radius: 8px; background: transparent; border: none; color: var(--text-dim); }
      .cw-icon-btn-tiny:hover { background: rgba(255,255,255,0.08); color: var(--text); }

      /* Stat cards */
      .cw-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .cw-stat-card { display: flex; align-items: center; gap: 14px; background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 18px; }
      .cw-stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .cw-tone-blue { background: var(--blue-soft); color: var(--blue); }
      .cw-tone-red { background: var(--red-soft); color: var(--red); }
      .cw-tone-green { background: var(--green-soft); color: var(--green); }
      .cw-tone-purple { background: var(--purple-soft); color: var(--purple); }
      .cw-stat-label { font-size: 11px; letter-spacing: 0.04em; color: var(--text-dim); font-weight: 700; }
      .cw-stat-value { font-family: 'Manrope', sans-serif; font-size: 24px; font-weight: 800; margin: 2px 0; }
      .cw-stat-note { font-size: 12px; color: var(--text-dimmer); }

      /* Panels */
      .cw-panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 20px; }
      .cw-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 10px; flex-wrap: wrap; }
      .cw-panel-head h3 { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

      /* Dashboard analytics */
      .cw-dashboard-analytics { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }

      /* Weekly chart */
      .cw-weekly-panel { min-height: 280px; }
      .cw-weekly-chart { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; height: 200px; padding-top: 10px; }
      .cw-weekly-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
      .cw-weekly-bar-track { width: 100%; max-width: 42px; height: 140px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: flex-end; overflow: hidden; }
      .cw-weekly-bar { width: 100%; background: linear-gradient(180deg, var(--blue), var(--blue-soft)); border-radius: 8px 8px 0 0; transition: height .3s ease; min-height: 4px; }
      .cw-weekly-bar-wrap.is-today .cw-weekly-bar { background: linear-gradient(180deg, var(--red), rgba(232,72,63,0.5)); }
      .cw-weekly-label { font-size: 11px; font-weight: 700; color: var(--text-dim); }
      .cw-weekly-bar-wrap.is-today .cw-weekly-label { color: var(--red); }
      .cw-weekly-val { font-size: 10px; color: var(--text-dimmer); }

      /* Completion ring */
      .cw-month-panel { display: flex; flex-direction: column; }
      .cw-completion-ring-wrap { position: relative; width: 120px; height: 120px; margin: 10px auto 20px; }
      .cw-completion-ring { width: 100%; height: 100%; }
      .cw-completion-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .cw-completion-pct { font-family: 'Manrope', sans-serif; font-size: 26px; font-weight: 800; }
      .cw-completion-label { font-size: 11px; color: var(--text-dim); font-weight: 600; }
      .cw-month-stats { display: flex; flex-direction: column; }

      .cw-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .cw-status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); }
      .cw-status-pill .cw-dot { background: var(--dot); }

      /* Full kanban (My Tasks) */
      .cw-kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; width: 100%; }
      .cw-kanban-col { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 16px; min-height: 220px; transition: background .15s, border-color .15s; min-width: 200px; }
      .cw-kanban-col.drag-over { background: rgba(255,255,255,0.06); border-color: rgba(232,72,63,0.4); }
      .cw-kanban-col-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
      .cw-kanban-col-body { display: flex; flex-direction: column; gap: 10px; min-height: 40px; }
      .cw-mini-count { margin-left: auto; background: rgba(255,255,255,0.08); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px; color: var(--text-dim); }
      .cw-task-card { background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); border-radius: 12px; padding: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
      .cw-task-card:hover { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.05); }
      .cw-task-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; font-size: 13.5px; font-weight: 600; }
      .cw-task-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; }
      .cw-strike { text-decoration: line-through; color: var(--text-dimmer); }
      .cw-priority { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; }
      .cw-done-label { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--green); font-weight: 600; }
      .cw-task-due { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-dim); }
      .cw-add-task-inline { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 12px; border: 1px dashed var(--panel-border); background: transparent; color: var(--red); font-size: 12.5px; font-weight: 700; }
      .cw-add-task-inline:hover { background: var(--red-soft); }
      .cw-task-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
      .cw-task-project { font-size: 11px; color: var(--text-dim); background: rgba(255,255,255,0.06); padding: 1px 8px; border-radius: 20px; }
      .cw-menu-wrap { position: relative; }
      .cw-menu { position: absolute; right: 0; top: 28px; background: var(--panel-solid); border: 1px solid var(--panel-border); border-radius: 10px; padding: 5px; z-index: 20; min-width: 120px; box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
      .cw-menu button { display: flex; align-items: center; gap: 7px; width: 100%; padding: 7px 9px; background: none; border: none; color: var(--text); font-size: 12.5px; border-radius: 7px; text-align: left; }
      .cw-menu button:hover { background: rgba(255,255,255,0.06); }
      .cw-menu button.danger { color: var(--red); }

      /* Worklog */
      .cw-inline-edit { cursor: pointer; border-bottom: 1px dashed rgba(255,255,255,0.3); transition: color .15s, border-color .15s; }
      .cw-inline-edit:hover { color: var(--red); border-bottom-color: var(--red); }
      
      /* Dashboard */
      .cw-dashboard-side-stack { display: flex; flex-direction: column; gap: 20px; }
      .cw-notify-list { display: flex; flex-direction: column; gap: 10px; }
      .cw-notify-item { padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); border-radius: 10px; }
      .cw-notify-text { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
      .cw-notify-time { font-size: 11px; color: var(--text-dim); }

      .cw-worklog-table, .cw-reports-table, .cw-team-table { display: flex; flex-direction: column; }
      .cw-worklog-row { display: grid; grid-template-columns: 150px 1.4fr 140px 1fr 90px 60px; gap: 12px; align-items: center; padding: 12px 4px; border-bottom: 1px solid var(--panel-border); font-size: 13px; }
      .cw-worklog-row:last-child { border-bottom: none; }
      .cw-worklog-head { color: var(--text-dim); font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em; }
      .cw-worklog-total { display: flex; align-items: center; justify-content: space-between; padding: 14px 4px 4px; border-top: 2px solid var(--panel-border); margin-top: 4px; font-size: 13px; font-weight: 700; color: var(--text-dim); }
      .cw-worklog-total strong { color: var(--text); font-size: 15px; }
      .cw-chip { background: rgba(76,125,255,0.14); color: var(--blue); font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
      .cw-chip-green { background: var(--green-soft); color: var(--green); }
      .cw-chip-red { background: var(--red-soft); color: var(--red); }
      .cw-chip-blue { background: var(--blue-soft); color: var(--blue); }
      .cw-row-actions { display: flex; gap: 4px; }

      /* Reports */
      .cw-reports-row { display: grid; grid-template-columns: 2fr 100px 110px 110px 110px; gap: 10px; align-items: center; padding: 13px 4px; border-bottom: 1px solid var(--panel-border); font-size: 13px; }
      .cw-reports-row:last-child { border-bottom: none; }
      .cw-reports-head { color: var(--text-dim); font-size: 11.5px; font-weight: 700; }
      .cw-reports-file { display: flex; align-items: center; gap: 9px; font-weight: 600; }

      /* Team / Management */
      .cw-team-row { display: grid; grid-template-columns: 1.8fr 90px 90px 90px 130px 110px; gap: 10px; align-items: center; padding: 13px 4px; border-bottom: 1px solid var(--panel-border); font-size: 13px; }
      .cw-team-row:last-child { border-bottom: none; }
      .cw-team-head { color: var(--text-dim); font-size: 11.5px; font-weight: 700; }
      .cw-team-emp { display: flex; align-items: center; gap: 10px; font-weight: 600; }

      /* Management tabs */
      .cw-mgmt-tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--panel-border); padding-bottom: 8px; }
      .cw-mgmt-tab { background: none; border: none; color: var(--text-dim); font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px; }
      .cw-mgmt-tab:hover { background: rgba(255,255,255,0.04); }
      .cw-mgmt-tab.active { background: var(--red-soft); color: var(--red); }
      .cw-mgmt-list { display: flex; flex-direction: column; gap: 4px; }
      .cw-mgmt-list-item { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--panel-border); font-size: 13px; }
      .cw-mgmt-list-item:last-child { border-bottom: none; }

      /* Upload zone */
      .cw-upload-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 42px 20px; border: 1.5px dashed var(--panel-border); border-radius: var(--radius); background: var(--panel); cursor: pointer; transition: border-color .15s, background .15s; }
      .cw-upload-zone.dragging, .cw-upload-zone:hover { border-color: rgba(232,72,63,0.5); background: rgba(232,72,63,0.05); }
      .cw-upload-title { font-size: 15px; font-weight: 700; margin-top: 4px; }
      .cw-upload-note { font-size: 12.5px; color: var(--text-dim); max-width: 420px; margin-bottom: 6px; }

      /* Calendar page */
      .cw-calendar-layout { display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start; }
      .cw-calendar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
      .cw-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
      .cw-cal-dow { margin-bottom: 8px; }
      .cw-cal-dow span { text-align: center; font-size: 11px; color: var(--text-dimmer); font-weight: 700; }
      .cw-cal-cell { position: relative; aspect-ratio: 1/0.85; border-radius: 12px; border: 1px solid var(--panel-border); background: rgba(255,255,255,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--text); }
      .cw-cal-cell.empty { border: none; background: none; }
      .cw-cal-cell:hover:not(.empty) { background: rgba(255,255,255,0.06); }
      .cw-cal-cell.sel { background: var(--red); border-color: var(--red); }
      .cw-cal-cell.today:not(.sel) { border-color: rgba(232,72,63,0.5); }
      .cw-cal-ad { font-size: 15px; font-weight: 700; }
      .cw-cal-bs { font-size: 9.5px; color: var(--text-dim); }
      .cw-cal-cell.sel .cw-cal-bs { color: rgba(255,255,255,0.85); }
      .cw-cal-dot { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); }
      .cw-cal-detail-stat { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--panel-border); font-size: 13.5px; }
      .cw-cal-detail-stat:last-of-type { border-bottom: none; }
      .cw-cal-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
      .cw-readonly-text { font-size: 13px; color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; margin: 6px 0 12px; }
      .cw-minical-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--blue); display: inline-block; }
      .cw-minical-nav { display: flex; gap: 6px; align-items: center; }

      /* Daily Summary page */
      .cw-summary-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
      .cw-summary-form { }
      .cw-summary-actions { display: flex; gap: 10px; margin-top: 20px; }
      .cw-summary-history { }
      .cw-history-list { display: flex; flex-direction: column; gap: 4px; }
      .cw-history-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px; background: none; border: none; color: var(--text); font-size: 13px; font-weight: 600; text-align: left; width: 100%; }
      .cw-history-item:hover { background: rgba(255,255,255,0.04); }
      .cw-history-item.active { background: var(--red-soft); }
      .cw-manager-review { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--panel-border); }

      /* Settings */
      .cw-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .cw-toggle { width: 36px; height: 20px; appearance: none; background: rgba(255,255,255,0.12); border-radius: 20px; position: relative; cursor: pointer; border: none; }
      .cw-toggle:checked { background: var(--green); }
      .cw-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
      .cw-toggle:checked::after { transform: translateX(16px); }

      /* Forms */
      .cw-field-label { display: block; font-size: 12px; color: var(--text-dim); font-weight: 600; margin: 12px 0 6px; }
      .cw-row-between { display: flex; align-items: center; justify-content: space-between; }
      .cw-textarea, .cw-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--panel-border); border-radius: 10px; padding: 10px 12px; color: var(--text); font-size: 13.5px; resize: vertical; }
      .cw-textarea:focus, .cw-input:focus { outline: none; border-color: rgba(232,72,63,0.5); }
      .cw-textarea:disabled { opacity: 0.6; resize: none; }
      .cw-submitted-badge { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--green); background: var(--green-soft); padding: 8px 10px; border-radius: 10px; }

      /* Modal */
      .cw-modal-overlay { position: fixed; inset: 0; background: rgba(4,6,14,0.65); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
      .cw-modal { width: 100%; background: var(--panel-solid); border: 1px solid var(--panel-border); border-radius: 18px; box-shadow: 0 30px 80px rgba(0,0,0,0.5); max-height: 88vh; display: flex; flex-direction: column; animation: cw-modal-in .16s ease; }
      @keyframes cw-modal-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      .cw-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--panel-border); }
      .cw-modal-body { padding: 20px; overflow-y: auto; }
      .cw-modal-actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
      .cw-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .cw-duration-preview { margin-top: 14px; font-size: 13px; color: var(--text-dim); }

      /* Empty state */
      .cw-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 30px 10px; text-align: center; }
      .cw-empty-title { font-size: 13.5px; font-weight: 600; color: var(--text-dim); }
      .cw-empty-note { font-size: 12px; color: var(--text-dimmer); max-width: 260px; }

      /* Toasts */
      .cw-toast-stack { position: fixed; bottom: 22px; right: 22px; display: flex; flex-direction: column; gap: 8px; z-index: 200; }
      .cw-toast { display: flex; align-items: center; gap: 8px; background: var(--panel-solid); border: 1px solid var(--panel-border); padding: 12px 16px; border-radius: 12px; font-size: 13px; box-shadow: 0 12px 30px rgba(0,0,0,0.4); animation: cw-toast-in .18s ease; }
      .cw-toast-success { border-color: rgba(34,197,94,0.35); }
      .cw-toast-error { border-color: rgba(232,72,63,0.4); }
      @keyframes cw-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

      /* Role Switcher (prototype only) */
      .cw-role-switcher { position: fixed; bottom: 22px; left: 22px; z-index: 200; }
      .cw-role-switch-btn { display: flex; align-items: center; gap: 6px; background: var(--panel-solid); border: 1px solid var(--panel-border); color: var(--text-dim); padding: 8px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
      .cw-role-switch-btn:hover { background: rgba(16,21,42,0.95); color: var(--text); }
      .cw-role-menu { position: absolute; bottom: 44px; left: 0; background: var(--panel-solid); border: 1px solid var(--panel-border); border-radius: 14px; padding: 8px; min-width: 260px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
      .cw-role-menu-title { font-size: 11px; color: var(--text-dimmer); font-weight: 700; padding: 6px 10px; letter-spacing: 0.04em; text-transform: uppercase; }
      .cw-role-menu-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: none; border: none; color: var(--text); width: 100%; text-align: left; font-size: 13px; }
      .cw-role-menu-item:hover { background: rgba(255,255,255,0.05); }
      .cw-role-menu-item.active { background: var(--red-soft); }

      /* Mobile Bottom Nav */
      .cw-bottom-nav { display: none; }
      .cw-more-overlay { display: none; }
      .cw-more-menu { display: none; }

      /* ============================== Responsive ============================== */

      @media (max-width: 1280px) {
        .cw-dashboard-analytics { grid-template-columns: 1fr 280px; }
      }

      @media (max-width: 1180px) {
        .cw-dashboard-analytics, .cw-calendar-layout, .cw-summary-layout { grid-template-columns: 1fr; }
        .cw-kanban { grid-template-columns: repeat(2, 1fr); }
        .cw-settings-grid { grid-template-columns: 1fr; }
      }

      @media (max-width: 900px) {
        .cw-sidebar { position: fixed; left: -260px; top: 0; z-index: 60; transition: left .2s ease; background: var(--bg-2); }
        .cw-sidebar-open { left: 0; }
        .cw-sidebar-scrim { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; }
        .cw-mobile-topbar { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--panel-border); position: sticky; top: 0; background: var(--bg); z-index: 40; width: 100%; }
        .cw-app { flex-direction: column; }
        .cw-main { padding: 20px 16px 100px; }
        .cw-stat-grid { grid-template-columns: repeat(2, 1fr); }

        .cw-bottom-nav {
          display: flex; position: fixed; bottom: 0; left: 0; right: 0;
          background: var(--bg-2); border-top: 1px solid var(--panel-border);
          padding: 6px 8px; padding-bottom: max(6px, env(safe-area-inset-bottom));
          z-index: 45; justify-content: space-around;
        }
        .cw-bottom-nav-item {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; color: var(--text-dim); font-size: 10px; font-weight: 600;
          padding: 6px 10px; border-radius: 10px; min-width: 56px;
        }
        .cw-bottom-nav-item:hover, .cw-bottom-nav-item.active { color: var(--red); }
        .cw-bottom-nav-item.active { background: var(--red-soft); }

        .cw-more-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 44; }
        .cw-more-menu {
          display: flex; flex-direction: column; gap: 2px;
          position: fixed; bottom: 64px; right: 12px; left: 12px;
          background: var(--panel-solid); border: 1px solid var(--panel-border);
          border-radius: 14px; padding: 8px; z-index: 46;
          box-shadow: 0 -10px 30px rgba(0,0,0,0.3);
        }
        .cw-more-item {
          display: flex; align-items: center; gap: 10px; padding: 12px 14px;
          border-radius: 10px; background: none; border: none;
          color: var(--text); font-size: 14px; font-weight: 600; text-align: left;
        }
        .cw-more-item:hover { background: rgba(255,255,255,0.04); }
        .cw-more-item.active { background: var(--red-soft); color: var(--red); }

        .cw-role-switcher { bottom: 74px; left: 12px; }
        .cw-toast-stack { bottom: 80px; right: 12px; }

        .cw-form-row { grid-template-columns: 1fr; }
        .cw-team-row { grid-template-columns: 1fr; gap: 6px; padding: 16px 4px; }
        .cw-team-row.cw-team-head { display: none; }
        .cw-worklog-row { grid-template-columns: 1fr; gap: 4px; padding: 14px 4px; }
        .cw-worklog-row.cw-worklog-head { display: none; }
        .cw-reports-row { grid-template-columns: 1fr; gap: 4px; padding: 14px 4px; }
        .cw-reports-row.cw-reports-head { display: none; }

        .cw-page-head { flex-direction: column; gap: 12px; }
      }

      @media (max-width: 768px) {
        .cw-kanban {
          display: flex; overflow-x: auto; gap: 14px; padding-bottom: 8px;
          scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
        }
        .cw-kanban-col { min-width: 280px; flex-shrink: 0; scroll-snap-align: start; }
        .cw-stat-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        .cw-stat-card { padding: 14px; }
        .cw-stat-value { font-size: 20px; }
        .cw-page-title { font-size: 24px; }
        .cw-date-title { font-size: 24px; }
        .cw-weekly-chart { height: 160px; }
        .cw-weekly-bar-track { height: 100px; }
      }

      @media (max-width: 430px) {
        .cw-main { padding: 16px 12px 100px; }
        .cw-page { gap: 16px; }
        .cw-stat-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
        .cw-stat-card { padding: 12px; gap: 10px; }
        .cw-stat-icon { width: 36px; height: 36px; }
        .cw-stat-value { font-size: 18px; }
        .cw-stat-label { font-size: 10px; }
        .cw-stat-note { font-size: 11px; }
        .cw-date-nav { gap: 4px; }
        .cw-pill-btn { padding: 8px 10px; font-size: 12px; }
        .cw-btn-primary { padding: 9px 12px; font-size: 12.5px; }
        .cw-panel { padding: 14px; border-radius: 12px; }
        .cw-kanban-col { min-width: 260px; padding: 12px; }
        .cw-cal-cell { border-radius: 8px; }
        .cw-cal-ad { font-size: 13px; }
        .cw-cal-bs { font-size: 8px; }
        .cw-upload-zone { padding: 28px 14px; }
      }
    `}</style>
    );
}

// Mount the app to the DOM if the root element exists (for browser prototyping without a bundler)
const rootElement = document.getElementById("root");
if (rootElement) {
    createRoot(rootElement).render(<App />);
}