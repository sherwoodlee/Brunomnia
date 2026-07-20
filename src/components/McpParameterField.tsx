import type { JsonValue } from '../types';
import {
  initialMcpParameterValue,
  mcpParameterSchemaNode,
  mcpParameterVariantKey,
  mcpScalarInputValue,
  mcpScalarOptionKey,
  type McpParameterPath,
} from '../lib/mcpParameterSchema';

type McpParameterFieldProps = {
  schema: JsonValue;
  rootSchema: JsonValue;
  value: unknown;
  path: McpParameterPath;
  label: string;
  required?: boolean;
  disabled?: boolean;
  variantPrefix: string;
  variants: Record<string, number>;
  onSet: (path: McpParameterPath, value: JsonValue) => void;
  onRemove: (path: McpParameterPath) => void;
  onRename: (parentPath: McpParameterPath, currentName: string, nextName: string) => void;
  onVariant: (key: string, index: number) => void;
};

const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const complexType = (type: ReturnType<typeof mcpParameterSchemaNode>['type']) => type === 'object' || type === 'array';
const fallbackValue = (schema: JsonValue, rootSchema: JsonValue): JsonValue => {
  const initial = initialMcpParameterValue(schema, rootSchema);
  if (initial !== undefined) return initial;
  const type = mcpParameterSchemaNode(schema, rootSchema).type;
  if (type === 'object') return {};
  if (type === 'array') return [];
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  return '';
};

export function McpParameterField({
  schema,
  rootSchema,
  value,
  path,
  label,
  required = false,
  disabled = false,
  variantPrefix,
  variants,
  onSet,
  onRemove,
  onRename,
  onVariant,
}: McpParameterFieldProps) {
  const variantKey = mcpParameterVariantKey(variantPrefix, path);
  const node = mcpParameterSchemaNode(schema, rootSchema, value, variants[variantKey]);
  const readOnly = disabled || node.readOnly;
  const title = node.title || label;
  const variantControl = node.variants.length ? <div className="mcp-schema-variant"><span>{title} shape</span><select aria-label={`${title} schema option`} disabled={readOnly} onChange={(event) => onVariant(variantKey, Number(event.target.value))} value={node.variantIndex}>{node.variants.map((variant, index) => <option key={`${variant.title}-${index}`} value={index}>{variant.title}</option>)}</select></div> : null;
  const description = node.description ? <small>{node.description}</small> : null;
  const optionalRemove = !required && path.length && value !== undefined ? <button className="mcp-schema-remove" disabled={readOnly} onClick={() => onRemove(path)} type="button">Remove field</button> : null;

  if (node.type === 'object') {
    const current = objectValue(value);
    const propertyNames = new Set(node.properties.map((property) => property.name));
    const allAdditionalEntries = Object.entries(current).filter(([name]) => !propertyNames.has(name));
    const additionalLimit = Math.max(0, 200 - node.properties.length);
    const additionalEntries = allAdditionalEntries.slice(0, additionalLimit);
    const addProperty = () => {
      const prefix = 'property';
      let name = prefix;
      let index = 2;
      while (Object.hasOwn(current, name)) { name = `${prefix}${index}`; index += 1; }
      onSet([...path, name], fallbackValue(node.additionalProperties === false ? {} : node.additionalProperties, rootSchema));
    };
    return <fieldset className="mcp-schema-field mcp-schema-object"><legend>{title}{required ? ' *' : ''}</legend>{variantControl}{description}{optionalRemove}{node.properties.map((property) => {
      const propertyPath = [...path, property.name];
      const propertyValue = current[property.name];
      const propertyNode = mcpParameterSchemaNode(property.schema, rootSchema, propertyValue, variants[mcpParameterVariantKey(variantPrefix, propertyPath)]);
      if (propertyValue === undefined && complexType(propertyNode.type) && !property.required) {
        return <button className="mcp-schema-add-field" disabled={readOnly} key={property.name} onClick={() => onSet(propertyPath, fallbackValue(property.schema, rootSchema))} type="button">Add {propertyNode.title || property.name}</button>;
      }
      return <McpParameterField disabled={readOnly} key={property.name} schema={property.schema} rootSchema={rootSchema} value={propertyValue} path={propertyPath} label={property.name} required={property.required} variantPrefix={variantPrefix} variants={variants} onSet={onSet} onRemove={onRemove} onRename={onRename} onVariant={onVariant} />;
    })}{additionalEntries.map(([name, entry]) => <div className="mcp-schema-additional" key={name}><label><span>Additional property</span><input defaultValue={name} disabled={readOnly} onBlur={(event) => {
      const nextName = event.target.value.trim();
      if (!nextName || (nextName !== name && Object.hasOwn(current, nextName))) event.currentTarget.value = name;
      else onRename(path, name, nextName);
    }} /></label><McpParameterField disabled={readOnly} schema={node.additionalProperties === false ? {} : node.additionalProperties} rootSchema={rootSchema} value={entry} path={[...path, name]} label={name} variantPrefix={variantPrefix} variants={variants} onSet={onSet} onRemove={onRemove} onRename={onRename} onVariant={onVariant} /></div>)}{node.additionalProperties !== false ? <button className="mcp-schema-add-field" disabled={readOnly || node.properties.length + allAdditionalEntries.length >= 200} onClick={addProperty} type="button">Add property</button> : null}{node.truncated || allAdditionalEntries.length > additionalEntries.length ? <p>Only the first bounded schema fields are shown. The JSON overview retains the complete value.</p> : null}</fieldset>;
  }

  if (node.type === 'array') {
    const allItems = Array.isArray(value) ? value : [];
    const items = allItems.slice(0, 200);
    const itemSchema = node.itemSchema ?? {};
    return <fieldset className="mcp-schema-field mcp-schema-array"><legend>{title}{required ? ' *' : ''}</legend>{variantControl}{description}{optionalRemove}{items.map((item, index) => <div className="mcp-schema-array-item" key={index}><McpParameterField disabled={readOnly} schema={itemSchema} rootSchema={rootSchema} value={item} path={[...path, index]} label={`Item ${index + 1}`} required variantPrefix={variantPrefix} variants={variants} onSet={onSet} onRemove={onRemove} onRename={onRename} onVariant={onVariant} /><button className="mcp-schema-remove" disabled={readOnly} onClick={() => onRemove([...path, index])} type="button">Remove item</button></div>)}<button className="mcp-schema-add-field" disabled={readOnly || allItems.length >= 200} onClick={() => onSet([...path, allItems.length], fallbackValue(itemSchema, rootSchema))} type="button">Add item</button>{node.truncated || allItems.length > items.length ? <p>The server schema or current array exceeded the bounded guided view. Continue in the JSON overview.</p> : null}</fieldset>;
  }

  if (node.options.length) {
    const selected = value === undefined ? '' : mcpScalarOptionKey(value);
    return <div className="mcp-schema-field">{variantControl}<label><span>{title}{required ? ' *' : ''}</span><select disabled={readOnly} onChange={(event) => {
      if (!event.target.value) onRemove(path);
      else {
        const option = node.options.find((candidate) => mcpScalarOptionKey(candidate.value) === event.target.value);
        if (option) onSet(path, option.value);
      }
    }} required={required} value={selected}><option value="">Choose…</option>{node.options.map((option) => <option key={mcpScalarOptionKey(option.value)} value={mcpScalarOptionKey(option.value)}>{option.label}</option>)}</select></label>{description}{optionalRemove}</div>;
  }

  if (node.type === 'boolean') return <div className="mcp-schema-field">{variantControl}<label className="mcp-guided-toggle"><span>{title}{required ? ' *' : ''}</span><input checked={value === true} disabled={readOnly} onChange={(event) => onSet(path, event.target.checked)} type="checkbox" /></label>{description}{optionalRemove}</div>;
  if (node.type === 'null') return <div className="mcp-schema-field"><span>{title}{required ? ' *' : ''}</span>{variantControl}<button disabled={readOnly} onClick={() => onSet(path, null)} type="button">Set null</button>{description}{optionalRemove}</div>;
  if (node.type === 'string' || node.type === 'number' || node.type === 'integer') return <div className="mcp-schema-field">{variantControl}<label><span>{title}{required ? ' *' : ''}</span><input disabled={readOnly} onChange={(event) => onSet(path, mcpScalarInputValue(node.type, event.target.value))} required={required} type={node.type === 'string' ? 'text' : 'number'} value={String(value ?? '')} /></label>{description}{optionalRemove}</div>;
  return <div className="mcp-schema-field mcp-schema-unsupported"><strong>{title}{required ? ' *' : ''}</strong>{variantControl}{description}<p>This schema shape remains editable in the JSON overview.</p>{optionalRemove}</div>;
}
