import { destroy, detach, getParent, hasParentOfType, Instance, types } from 'mobx-state-tree';
import { JSONObject } from '../../interfaces/JSONObject';
import { Settings } from '../settings';

export type ISchemaField = Instance<typeof SchemaField>;
export interface IAddField {
  name: string;
  title: string;
  description: string;
  group?: string;
  type?: string;
}

export const DEFAULT_TYPE = 'string';
export const DEFAULT_GROUP_TITLE = 'Main';

export const SchemaField = types
  .model('SchemaField', {
    id: types.identifier,
    type: types.string,
    name: types.string,
    title: types.string,
    description: types.maybeNull(types.string),
    primary: types.optional(types.boolean, false),
    schemaId: types.maybeNull(types.string),
    options: types.frozen<JSONObject>(),
    group: DEFAULT_GROUP_TITLE,
    fields: types.maybeNull(types.array(types.late((): any => SchemaField))),
    __typename: types.maybeNull(types.string),
  })
  .preProcessSnapshot(snapshot => ({
    ...snapshot,
    fields: snapshot.fields || [],
  }))
  .views(self => ({
    get isLeaf(): boolean {
      return !hasParentOfType(self, SchemaField);
    },
    get defaultOptions() {
      const settingsField = Settings.fields.find((f: any) => f.type === self.type);
      if (settingsField) {
        return settingsField.options;
      }
      return {};
    },
  }))
  .actions(self => ({
    update(obj: {
      name: string;
      title: string;
      description: string;
      type: string;
      options: JSONObject;
    }) {
      self.name = obj.name;
      self.title = obj.title;
      self.description = obj.description;
      self.type = obj.type;
      self.options = obj.options;
    },
    setIsDisplay(isDisplay: boolean) {
      self.primary = isDisplay;
    },
  }));

const SchemaGroup = types.model('SchemaGroup', {
  title: types.string,
  fields: types.array(SchemaField),
});

export const Schema = types
  .model({
    groups: types.optional(types.array(SchemaGroup), []),
    hasChanged: false,
  })
  .views(self => ({
    get fields() {
      if (!self.groups) {
        return [];
      }
      return self.groups.reduce((acc: ISchemaField[], group) => {
        group.fields.forEach(field => {
          acc.push(field);
          if (field.fields) {
            field.fields.forEach((subfield: any) => acc.push(subfield as any));
          }
        });
        return acc;
      }, []);
    },
  }))
  .actions(self => ({
    setHasChanged(hasChanged: boolean) {
      self.hasChanged = hasChanged;
    },
    remove(node: ISchemaField) {
      destroy(node);
    },
    move(nodeId: string, position: number) {
      const node = self.fields.find(n => n.id === nodeId);
      if (node) {
        const tree = getParent(node) as ISchemaField[];
        detach(node);
        tree.splice(position, 0, node);
      }
    },
    add(
      obj: IAddField,
      position: number,
      groupName: string = DEFAULT_GROUP_TITLE,
      nodeId?: string
    ) {
      const id = `new-${Array.from({ length: 5 })
        .map(() => 100000 + Math.floor(Math.random() * 99999))
        .join('-')}`;
      const node = self.fields.find(n => n.id === nodeId);
      const group = self.groups.find(n => n.title === groupName);
      const tree = nodeId ? node && node.fields : group && group.fields;
      const contentType = getParent(self) as any;

      if (tree) {
        const newField = SchemaField.create({
          id,
          name: obj.name,
          title: obj.title,
          description: obj.description,
          primary: obj.type === 'string' && !self.fields.find(f => f.primary),
          schemaId: contentType.id,
          type: obj.type || DEFAULT_TYPE,
          group: obj.group || DEFAULT_GROUP_TITLE,
          options: {},
          fields: [],
        });
        tree.splice(position, 0, newField);
        return newField;
      }
      return null;
    },
    setDisplay(node: ISchemaField) {
      self.fields.forEach(field => field.setIsDisplay(false));
      node.setIsDisplay(true);
    },
    addGroup(title: string) {
      if (self.groups.find(g => g.title.toLowerCase() === title.toLowerCase())) {
        return;
      }

      self.groups.push(
        SchemaGroup.create({
          title,
          fields: [],
        })
      );
    },
    removeGroup(title: string) {
      const node = self.groups.find(g => g.title === title);
      if (node) {
        destroy(node);
      }
    },
  }));
