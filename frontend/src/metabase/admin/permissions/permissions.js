import { createAction, createThunkAction, handleActions, combineReducers, AngularResourceProxy } from "metabase/lib/redux";

const MetadataApi = new AngularResourceProxy("Metabase", ["db_list_with_tables"]);
const PermissionsApi = new AngularResourceProxy("Permissions", ["groups", "graph", "updateGraph"]);

const INITIALIZE = "metabase/admin/permissions/INITIALIZE";
export const initialize = createThunkAction(INITIALIZE, () =>
    async (dispatch, getState) => {
        await Promise.all([
            dispatch(loadPermissions()),
            dispatch(loadGroups()),
            dispatch(loadMetadata())
        ]);
    }
);

const LOAD_PERMISSIONS = "metabase/admin/permissions/LOAD_PERMISSIONS";
export const loadPermissions = createAction(LOAD_PERMISSIONS, () => PermissionsApi.graph());

const LOAD_GROUPS = "metabase/admin/permissions/LOAD_GROUPS";
export const loadGroups = createAction(LOAD_GROUPS, () => PermissionsApi.groups());

const LOAD_METADATA = "metabase/admin/permissions/LOAD_METADATA";
export const loadMetadata = createAction(LOAD_METADATA, () => MetadataApi.db_list_with_tables());

const UPDATE_PERMISSION = "metabase/admin/permissions/UPDATE_PERMISSION";
export const updatePermission = createAction(UPDATE_PERMISSION);

const SAVE_PERMISSIONS = "metabase/admin/permissions/SAVE_PERMISSIONS";
export const savePermissions = createThunkAction(SAVE_PERMISSIONS, () =>
    async (dispatch, getState) => {
        const { permissions, revision } = getState().permissions;
        let result = await PermissionsApi.updateGraph({
            revision: revision,
            groups: permissions
        });
        return result;
    }
)


const permissions = handleActions({
    [LOAD_PERMISSIONS]: { next: (state, { payload }) => payload.groups },
    [SAVE_PERMISSIONS]: { next: (state, { payload }) => payload.groups },
    [UPDATE_PERMISSION]: { next: (state, { payload: { groupId, entityId, value, updater } }) => {
        return updater(state, groupId, entityId, value);
    }}
}, null);

const originalPermissions = handleActions({
    [LOAD_PERMISSIONS]: { next: (state, { payload }) => payload.groups },
    [SAVE_PERMISSIONS]: { next: (state, { payload }) => payload.groups },
}, null);

const revision = handleActions({
    [LOAD_PERMISSIONS]: { next: (state, { payload }) => payload.revision },
    [SAVE_PERMISSIONS]: { next: (state, { payload }) => payload.revision },
}, null);

const getGroupDisplayName = (name) =>
    name === "Admin" ? "Administrator" :
    name === "Default" ? "All Users" :
    name;

const groups = handleActions({
    [LOAD_GROUPS]: { next: (state, { payload }) =>
        payload && payload.map(group => ({
            ...group,
            name: getGroupDisplayName(group.name),
            // special case admin group to be non-editable
            editable: group.name !== "Admin"
        }))
    },
}, null);

const databases = handleActions({
    [LOAD_METADATA]: { next: (state, { payload }) => payload },
}, null);

const saveError = handleActions({
    [SAVE_PERMISSIONS]: {
        next: (state) => null,
        throw: (state, { payload }) => payload && payload.data
    },
    [LOAD_PERMISSIONS]: {
        next: (state) => null,
    }
}, null);

export default combineReducers({
    permissions,
    originalPermissions,
    saveError,
    revision,
    groups,
    databases
});
