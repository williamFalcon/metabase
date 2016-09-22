
import { createSelector } from 'reselect';

import _ from "underscore";
import { getIn, setIn } from "icepick";

const getGroups = (state) => state.permissions.groups;
const getDatabases = (state) => state.permissions.databases;
const getPermissions = (state) => state.permissions.permissions;
const getOriginalPermissions = (state) => state.permissions.originalPermissions;

const getParams = (state, props) => props.params;

export const getDirty = createSelector(
    getPermissions, getOriginalPermissions,
    (permissions, originalPermissions) =>
        JSON.stringify(permissions) !== JSON.stringify(originalPermissions)
)

export const getSaveError = (state) => state.permissions.saveError;

const getAccess = (value) => {
    if (!value) {
        return "none";
    } else if (typeof value === "object") {
        return "controlled";
    } else {
        return value;
    }
}

const getDatabasePermissions = (permissions, dbId) => {
    let db = getIn(permissions, [dbId]);
    return {
        native: db.native,
        schemas: getAccess(db.schemas)
    };
}

const getSchemaPermissions = (permissions, dbId, schemaName) => {
    let { schemas } = getDatabasePermissions(permissions, dbId);
    if (schemas === "controlled") {
        let tables = getIn(permissions, [dbId, "schemas", schemaName]);
        if (tables) {
            return {
                tables: getAccess(tables)
            };
        } else {
            return {
                tables: "none"
            };
        }
    } else {
        return {
            tables: schemas
        };
    }
}

const getTablePermissions = (permissions, dbId, schemaName, tableId) => {
    let { tables } = getSchemaPermissions(permissions, dbId, schemaName);
    if (tables === "controlled") {
        let fields = getIn(permissions, [dbId, "schemas", schemaName, tableId]);
        if (fields) {
            return {
                fields: getAccess(fields)
            };
        } else {
            return {
                fields: "none"
            };
        }
    } else {
        return {
            fields: tables
        };
    }
}


function updatePermission(permissions, path, value, entityIds) {
    let current = getIn(permissions, path);
    if (current === value || (current && typeof current === "object" && value === "controlled")) {
        return permissions;
    }
    if (value === "controlled") {
        value = {};
        if (entityIds) {
            for (let entityId of entityIds) {
                value[entityId] = current
            }
        }
    }
    for (var i = 0; i < path.length; i++) {
        if (typeof getIn(permissions, path.slice(0, i)) === "string") {
            permissions = setIn(permissions, path.slice(0, i), {});
        }
    }
    return setIn(permissions, path, value);
}

export const getPermissionsGrid = createSelector(
    getGroups, getDatabases, getPermissions, getParams,
    (groups, databases, permissions, params) => {
        if (groups && databases && permissions) {
            let databaseId = params.databaseId ? parseInt(params.databaseId) : null
            let schemaName = params.schemaName;
            if (databaseId != null && schemaName != null) {
                let database = _.findWhere(databases, { id: databaseId });
                let tables = database.tables.filter(table => table.schema === schemaName);

                let schemaNames = _.uniq(database.tables.map(table => table.schema));
                let tableIds = tables.map(table => table.id);

                return {
                    type: "table",
                    groups,
                    permissions: {
                        "fields": (perms, groupId, { databaseId, schemaName, tableId }, value) => {
                            perms = updatePermission(perms, [groupId, databaseId, "schemas"], "controlled", schemaNames);
                            perms = updatePermission(perms, [groupId, databaseId, "schemas", schemaName], "controlled", tableIds);
                            perms = updatePermission(perms, [groupId, databaseId, "schemas", schemaName, tableId], value /* TODO: field ids, when enabled "controlled" fields */);
                            return perms;
                        }
                    },
                    entities: tables.map(table => ({
                        id: {
                            databaseId: databaseId,
                            schemaName: schemaName,
                            tableId: table.id
                        },
                        name: table.display_name,
                    })),
                    data: tables.map(table =>
                        groups.map(group =>
                            getTablePermissions(permissions[group.id], databaseId, schemaName, table.id)
                        )
                    )
                }
            } else if (databaseId != null) {
                let database = _.findWhere(databases, { id: databaseId });
                let schemaNames = _.uniq(database.tables.map(table => table.schema));
                return {
                    type: "schema",
                    groups,
                    permissions: {
                        "tables": (perms, groupId, { databaseId, schemaName }, value) => {
                            let tableIds = database.tables.filter(table => table.schema === schemaName).map(table => table.id);
                            perms = updatePermission(perms, [groupId, databaseId, "schemas"], "controlled", schemaNames);
                            perms = updatePermission(perms, [groupId, databaseId, "schemas", schemaName], value, tableIds);
                            return perms;
                        }
                    },
                    entities: schemaNames.map(schemaName => ({
                        id: {
                            databaseId,
                            schemaName
                        },
                        name: schemaName,
                        link: { name: "View tables", url: `/admin/permissions/databases/${databaseId}/schemas/${encodeURIComponent(schemaName)}/tables`}
                    })),
                    data: schemaNames.map(schemaName =>
                        groups.map(group =>
                            getSchemaPermissions(permissions[group.id], databaseId, schemaName)
                        )
                    )
                }
            } else {
                return {
                    type: "database",
                    groups,
                    permissions: {
                        "native": (perms, groupId, { databaseId }, value) => {
                            return updatePermission(perms, [groupId, databaseId, "native"], value);
                        },
                        "schemas": (perms, groupId, { databaseId }, value) => {
                            let database = _.findWhere(databases, { id: databaseId });
                            let schemaNames = database && _.uniq(database.tables.map(table => table.schema));
                            return updatePermission(perms, [groupId, databaseId, "schemas"], value, schemaNames);
                        }
                    },
                    entities: databases.map(database => {
                        let schemas = _.uniq(database.tables.map(table => table.schema));
                        return {
                            id: {
                                databaseId: database.id
                            },
                            name: database.name,
                            link: schemas.length === 1 ?
                                { name: "View tables", url: `/admin/permissions/databases/${database.id}/schemas/${schemas[0]}/tables`} :
                                { name: "View schemas", url: `/admin/permissions/databases/${database.id}/schemas`}
                        }
                    }),
                    data: databases.map(database =>
                        groups.map(group =>
                            getDatabasePermissions(permissions[group.id], database.id)
                        )
                    )
                }
            }
        }

        return null;
    }
);
