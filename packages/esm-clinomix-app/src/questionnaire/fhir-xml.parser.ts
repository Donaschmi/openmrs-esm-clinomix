/**
 * Minimal FHIR R4 XML → JavaScript object converter.
 *
 * Rules:
 *  - Leaf elements with a `value` attribute become primitives:
 *      "true"/"false" → boolean, everything else → string.
 *  - Elements in ALWAYS_ARRAY (item, answer, answerOption …) always
 *    produce an array even when only one occurrence is present.
 *  - All other elements with siblings of the same local-name produce an array.
 *  - The root element's local-name is injected as `resourceType`.
 *
 * Note: integer/decimal coercion is intentionally skipped so that FHIR
 * linkIds ("1", "2" …) stay as strings and don't break Set/Map lookups.
 * The only type coercion applied is boolean, which is required for fields
 * like `required`, `repeats`, and `readOnly`.
 */

// Elements that must always be treated as arrays (even with one occurrence)
const ALWAYS_ARRAY = new Set([
  'item',
  'answer',
  'answerOption',
  'extension',
  'modifierExtension',
  'contained',
  'entry',
  'subjectType',
  'code',
  'useContext',
  'jurisdiction',
  'contact',
  'enableWhen',
]);

function parseElement(el: Element): unknown {
  const children = Array.from(el.children);
  const valueAttr = el.getAttribute('value');

  // Primitive leaf: element has a value attribute and no child elements
  if (children.length === 0) {
    if (valueAttr === null) return null;
    if (valueAttr === 'true') return true;
    if (valueAttr === 'false') return false;
    return valueAttr;
  }

  // Complex element: group children by local-name
  const obj: Record<string, unknown> = {};

  const groups = new Map<string, Element[]>();
  for (const child of children) {
    const name = child.localName;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(child);
  }

  for (const [name, els] of groups) {
    const parsed = els.map(parseElement);
    obj[name] = ALWAYS_ARRAY.has(name) || parsed.length > 1 ? parsed : parsed[0];
  }

  return obj;
}

/**
 * Parse a FHIR XML string into a plain JavaScript object that mirrors the
 * FHIR JSON representation.
 *
 * @throws if the XML is malformed or the document has no root element.
 */
export function parseFhirXml(xmlString: string): unknown {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const error = doc.querySelector('parsererror');
  if (error) {
    throw new Error(`XML parse error: ${error.textContent?.trim() ?? 'unknown'}`);
  }

  const root = doc.documentElement;
  if (!root) throw new Error('Empty XML document');

  const result = parseElement(root) as Record<string, unknown>;
  result.resourceType = root.localName;
  return result;
}

/** Detect whether a File is XML by extension or MIME type. */
export function isXmlFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.xml') || file.type === 'application/xml' || file.type === 'text/xml';
}
