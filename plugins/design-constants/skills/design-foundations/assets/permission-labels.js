/**
 * The one client-side piece of the permission model: a single ordered map of key to human
 * label, shared by the permission editor and by any "your access" summary elsewhere — so
 * two screens never describe the same permission two different ways.
 *
 * Replace these alongside the keys in permissions.js.
 *
 * Order matters: the everyone-by-default keys come first, so the screen reads as "the
 * ordinary ones, then the administrator ones".
 */
export const PERMISSION_LABELS = {
  editRecords:     'Edit Records',
  exportRecords:   'Export Records',
  deleteRecords:   'Permanently Delete Records',
  manageUsers:     'Manage User Accounts',
  viewActivityLog: 'View Activity Log',
};

/**
 * The ones an ordinary user has unless somebody takes them away. Used only to explain the
 * split on screen — the server decides.
 */
export const DEFAULT_FOR_EVERYONE = ['editRecords', 'exportRecords'];

/**
 * There is no third "inherit"/"default" state in the UI. Every permission reads as Allowed
 * or Denied for that person. "Default" is a state nobody can look at and know what it
 * actually means for the person in front of them.
 */
