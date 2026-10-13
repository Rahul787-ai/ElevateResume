(function () {
  'use strict';
  const C = ResumeCore;
  function serialize(data) {
    C.validate(data);
    const doc = document.implementation.createDocument('', 'resume');
    doc.documentElement.setAttribute('version', '2');
    const add = (parent, tag, value) => {
      const node = doc.createElement(tag); parent.appendChild(node);
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) value.forEach(item => add(node, 'item', item));
        else Object.entries(value).forEach(([k,v]) => add(node, k, v));
      } else node.textContent = String(value);
    };
    Object.entries(data).filter(([k]) => k !== 'version').forEach(([k,v]) => add(doc.documentElement, k, v));
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc);
  }
  function parse(text) {
    if (text.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML is too large or contains unsupported declarations.');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML. Existing data has not changed.');
    const root = doc.documentElement;
    if (root.tagName !== 'resume' || root.getAttribute('version') !== '2' || root.attributes.length !== 1) throw new Error('Expected ElevateResume version 2 XML.');
    const read = (node, shape) => {
      if (node.attributes.length && node !== root) throw new Error('Unexpected XML attributes.');
      if (Array.isArray(shape)) {
        if (Array.from(node.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) throw new Error('Unexpected XML text.');
        return Array.from(node.children).map(child => { if (child.tagName !== 'item') throw new Error('Unexpected XML item.'); return read(child, shape[0]); });
      }
      if (shape && typeof shape === 'object') {
        const children = Array.from(node.children);
        if (children.length !== Object.keys(shape).length || Array.from(node.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) throw new Error('Unexpected or missing XML fields.');
        return Object.fromEntries(Object.entries(shape).map(([k,v]) => {
          const found = children.filter(child => child.tagName === k);
          if (found.length !== 1) throw new Error('Duplicate or missing XML field.');
          return [k, read(found[0], v)];
        }));
      }
      if (node.children.length) throw new Error('Nested text is not supported.');
      if (typeof shape === 'boolean') {
        if (!['true', 'false'].includes(node.textContent)) throw new Error('Invalid XML confirmation.');
        return node.textContent === 'true';
      }
      return node.textContent;
    };
    const shape = C.blank(); delete shape.version;
    // Older version 2 exports have no signature; keep them importable.
    if (!Array.from(root.children).some(node => node.tagName === 'signature')) delete shape.signature;
    for (const section of Object.keys(C.fields)) {
      shape[section] = [C.entry(section)];
      if (shape[section][0].bullets) shape[section][0].bullets = [{ id: '', text: '' }];
    }
    return C.validate({ version: 2, ...read(root, shape) });
  }
  window.ResumeXML = { serialize, parse };
})();
