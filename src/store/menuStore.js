// Tiny store driving the right-click context menu. Any component can call
// menuStore.open(x, y, items) to pop a menu at the cursor.
let state = { open: false, x: 0, y: 0, items: [] };
const listeners = new Set();
const notify = () => listeners.forEach(f => f(state));

export const menuStore = {
  getState: () => state,
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  // items: [{ label, onClick, disabled, danger } | { divider: true }]
  open(x, y, items) { state = { open: true, x, y, items }; notify(); },
  close() { if (state.open) { state = { ...state, open: false }; notify(); } },
};
