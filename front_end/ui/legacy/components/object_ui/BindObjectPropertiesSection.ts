// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/*
 * Copyright (C) 2008 Apple Inc. All Rights Reserved.
 * Copyright (C) 2009 Joseph Pecoraro
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import * as Common from '../../../../core/common/common.js';
import type * as Components from '../utils/utils.js';
import * as Host from '../../../../core/host/host.js';
import * as i18n from '../../../../core/i18n/i18n.js';
import * as LinearMemoryInspector from '../../../components/linear_memory_inspector/linear_memory_inspector.js';
import * as Platform from '../../../../core/platform/platform.js';
import * as SDK from '../../../../core/sdk/sdk.js';
import * as TextUtils from '../../../../models/text_utils/text_utils.js';
import * as IconButton from '../../../components/icon_button/icon_button.js';
import * as UI from '../../legacy.js';

import { CustomPreviewComponent } from './CustomPreviewComponent.js';
import { JavaScriptAutocomplete } from './JavaScriptAutocomplete.js';
import { JavaScriptREPL } from './JavaScriptREPL.js';
import { createSpansForNodeTitle, RemoteObjectPreviewFormatter } from './RemoteObjectPreviewFormatter.js';
import { updateBindModel } from '../utils/DataBindingUtils.js';

// COHERENT_BEGIN
const MAX_DEPTH = 10;
// COHERENT_END

const UIStrings = {
  /**
  *@description Text in Object Properties Section
  *@example {function alert()  [native code] } PH1
  */
  exceptionS: '[Exception: {PH1}]',
  /**
  *@description Text in Object Properties Section
  */
  unknown: 'unknown',
  /**
  *@description Text to expand something recursively
  */
  expandRecursively: 'Expand recursively',
  /**
  *@description Text to collapse children of a parent group
  */
  collapseChildren: 'Collapse children',
  /**
  *@description Text in Object Properties Section
  */
  noProperties: 'No properties',
  /**
  *@description Element text content in Object Properties Section
  */
  dots: '(...)',
  /**
  *@description Element title in Object Properties Section
  */
  invokePropertyGetter: 'Invoke property getter',
  /**
  *@description Show all text content in Show More Data Grid Node of a data grid
  *@example {50} PH1
  */
  showAllD: 'Show all {PH1}',
  /**
  *@description Value element text content in Object Properties Section. Shown when the developer is
  *viewing a JavaScript object, but one of the properties is not readable and therefore can't be
  *displayed. This string should be translated.
  */
  unreadable: '<unreadable>',
  /**
  *@description Value element title in Object Properties Section
  */
  noPropertyGetter: 'No property getter',
  /**
  *@description A context menu item in the Watch Expressions Sidebar Pane of the Sources panel and Network pane request.
  */
  copyValue: 'Copy value',
  /**
  *@description A context menu item in the Object Properties Section
  */
  copyPropertyPath: 'Copy property path',
  /**
  * @description Text shown when displaying a JavaScript object that has a string property that is
  * too large for DevTools to properly display a text editor. This is shown instead of the string in
  * question. Should be translated.
  */
  stringIsTooLargeToEdit: '<string is too large to edit>',
  /**
  *@description Text of attribute value when text is too long
  *@example {30 MB} PH1
  */
  showMoreS: 'Show more ({PH1})',
  /**
  *@description Text of attribute value when text is too long
  *@example {30 MB} PH1
  */
  longTextWasTruncatedS: 'long text was truncated ({PH1})',
  /**
  *@description Text for copying
  */
  copy: 'Copy',
  edit: 'Click to edit',
  failedToEditModelProperty: "Failed to edit model data. Please verify that the data you're passing to the model is correct. Properties cannot be updated to a value of a different type than the existing one."
};
// COHERENT_BEGIN
const str_ = i18n.i18n.registerUIStrings('ui/legacy/components/object_ui/BindObjectPropertiesSection.ts', UIStrings);
// COHERENT_END
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
const EXPANDABLE_MAX_LENGTH = 50;

const parentMap = new WeakMap<SDK.RemoteObject.RemoteObjectProperty, SDK.RemoteObject.RemoteObject | null>();

const objectPropertiesSectionMap = new WeakMap<Element, BindObjectPropertiesSection>();

export const getObjectPropertiesSectionFrom = (element: Element): BindObjectPropertiesSection | undefined => {
  return objectPropertiesSectionMap.get(element);
};
// COHERENT_BEGIN
export class BindObjectPropertiesSection extends UI.TreeOutline.TreeOutlineInShadow {
  // COHERENT_END
  private readonly object: SDK.RemoteObject.RemoteObject;
  // COHERENT_BEGIN
  modelName: string;
  // COHERENT_END
  editable: boolean;
  private readonly objectTreeElementInternal: RootElement;
  titleElement: Element;
  skipProtoInternal?: boolean;
  constructor(
    // COHERENT_BEGIN
    modelName: string,
    object: SDK.RemoteObject.RemoteObject, title?: string | Element | null, linkifier?: Components.Linkifier.Linkifier,
    showOverflow?: boolean) {
    // COHERENT_END
    super();
    // COHERENT_BEGIN
    this.modelName = modelName;
    // COHERENT_END
    this.object = object;
    this.editable = true;
    if (!showOverflow) {
      this.hideOverflow();
    }
    this.setFocusable(true);
    this.setShowSelectionOnKeyboardFocus(true);
    this.objectTreeElementInternal = new RootElement(modelName, object, linkifier);
    this.appendChild(this.objectTreeElementInternal);
    if (typeof title === 'string' || !title) {
      this.titleElement = this.element.createChild('span');
      this.titleElement.textContent = title || '';
    } else {
      this.titleElement = title;
      this.element.appendChild(title);
    }
    if (this.titleElement instanceof HTMLElement && !this.titleElement.hasAttribute('tabIndex')) {
      this.titleElement.tabIndex = -1;
    }

    objectPropertiesSectionMap.set(this.element, this);
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectValue.css');
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectPropertiesSection.css');
    this.rootElement().childrenListElement.classList.add('source-code', 'object-properties-section');
  }

  static defaultObjectPresentation(
    // COHERENT_BEGIN
    modelName: string,
    // COHERENT_END
    object: SDK.RemoteObject.RemoteObject,
    linkifier?: Components.Linkifier.Linkifier,
    skipProto?: boolean,
    readOnly?: boolean
  ): Element {
    const objectPropertiesSection =
      // COHERENT_BEGIN
      BindObjectPropertiesSection.defaultObjectPropertiesSection(modelName, object, linkifier, skipProto, readOnly);
    // COHERENT_END
    if (!object.hasChildren) {
      return objectPropertiesSection.titleElement;
    }
    return objectPropertiesSection.element;
  }

  static defaultObjectPropertiesSection(
    // COHERENT_BEGIN
    modelName: string,
    // COHERENT_END
    object: SDK.RemoteObject.RemoteObject,
    linkifier?: Components.Linkifier.Linkifier,
    skipProto?: boolean,
    // COHERENT_BEGIN
    readOnly?: boolean
  ): BindObjectPropertiesSection {
    // COHERENT_END
    const titleElement = document.createElement('span');
    titleElement.classList.add('source-code');
    const shadowRoot = UI.Utils.createShadowRootWithCoreStyles(titleElement, {
      cssFile: 'ui/legacy/components/object_ui/objectValue.css',
      delegatesFocus: undefined,
    });
    const propertyValue =
      // COHERENT_BEGIN
      BindObjectPropertiesSection.createPropertyValue(object, /* wasThrown */ false, /* showPreview */ true);
    // COHERENT_END
    shadowRoot.appendChild(propertyValue.element);
    // COHERENT_BEGIN
    const objectPropertiesSection = new BindObjectPropertiesSection(modelName, object, titleElement, linkifier);
    // COHERENT_END
    objectPropertiesSection.editable = false;
    if (skipProto) {
      objectPropertiesSection.skipProto();
    }
    if (readOnly) {
      objectPropertiesSection.setEditable(false);
    }

    return objectPropertiesSection;
  }

  static compareProperties(
    propertyA: SDK.RemoteObject.RemoteObjectProperty,
    propertyB: SDK.RemoteObject.RemoteObjectProperty
  ): number {
    if (!propertyA.synthetic && propertyB.synthetic) {
      return 1;
    }
    if (!propertyB.synthetic && propertyA.synthetic) {
      return -1;
    }
    if (!propertyA.enumerable && propertyB.enumerable) {
      return 1;
    }
    if (!propertyB.enumerable && propertyA.enumerable) {
      return -1;
    }
    if (propertyA.symbol && !propertyB.symbol) {
      return 1;
    }
    if (propertyB.symbol && !propertyA.symbol) {
      return -1;
    }
    if (propertyA.private && !propertyB.private) {
      return 1;
    }
    if (propertyB.private && !propertyA.private) {
      return -1;
    }
    const a = propertyA.name;
    const b = propertyB.name;
    if (a.startsWith('_') && !b.startsWith('_')) {
      return 1;
    }
    if (b.startsWith('_') && !a.startsWith('_')) {
      return -1;
    }
    return Platform.StringUtilities.naturalOrderComparator(a, b);
  }

  static createNameElement(name: string | null, isPrivate?: boolean): Element {
    if (name === null) {
      return UI.Fragment.html`<span class="name"></span>`;
    }
    if (/^\s|\s$|^$|\n/.test(name)) {
      return UI.Fragment.html`<span class="name">"${name.replace(/\n/g, '\u21B5')}"</span>`;
    }
    if (isPrivate) {
      return UI.Fragment.html`<span class="name">
  <span class="private-property-hash">${name[0]}</span>${name.substring(1)}
  </span>`;
    }
    return UI.Fragment.html`<span class="name">${name}</span>`;
  }

  // COHERENT_BEGIN
  static updateNameElement(element: Element, name: string | null) {
    if (name === null) {
      element.textContent = '';
      return;
    }
    if (/^\s|\s$|^$|\n/.test(name)) {
      element.textContent = `"${name.replace(/\n/g, '\u21B5')}"`
      return;
    }

    element.textContent = name;
  }
  // COHERENT_END

  static valueElementForFunctionDescription(description?: string | null, includePreview?: boolean, defaultName?: string): Element {
    const valueElement = document.createElement('span');
    valueElement.classList.add('object-value-function');
    description = description || '';
    const text = description.replace(/^function [gs]et /, 'function ')
      .replace(/^function [gs]et\(/, 'function\(')
      .replace(/^[gs]et /, '');
    defaultName = defaultName || '';

    // This set of best-effort regular expressions captures common function descriptions.
    // Ideally, some parser would provide prefix, arguments, function body text separately.
    const asyncMatch = text.match(/^(async\s+function)/);
    const isGenerator = text.startsWith('function*');
    const isGeneratorShorthand = text.startsWith('*');
    const isBasic = !isGenerator && text.startsWith('function');
    const isClass = text.startsWith('class ') || text.startsWith('class{');
    const firstArrowIndex = text.indexOf('=>');
    const isArrow = !asyncMatch && !isGenerator && !isBasic && !isClass && firstArrowIndex > 0;

    let textAfterPrefix;
    if (isClass) {
      textAfterPrefix = text.substring('class'.length);
      const classNameMatch = /^[^{\s]+/.exec(textAfterPrefix.trim());
      let className: string = defaultName;
      if (classNameMatch) {
        className = classNameMatch[0].trim() || defaultName;
      }
      addElements('class', textAfterPrefix, className);
    } else if (asyncMatch) {
      textAfterPrefix = text.substring(asyncMatch[1].length);
      addElements('async \u0192', textAfterPrefix, nameAndArguments(textAfterPrefix));
    } else if (isGenerator) {
      textAfterPrefix = text.substring('function*'.length);
      addElements('\u0192*', textAfterPrefix, nameAndArguments(textAfterPrefix));
    } else if (isGeneratorShorthand) {
      textAfterPrefix = text.substring('*'.length);
      addElements('\u0192*', textAfterPrefix, nameAndArguments(textAfterPrefix));
    } else if (isBasic) {
      textAfterPrefix = text.substring('function'.length);
      addElements('\u0192', textAfterPrefix, nameAndArguments(textAfterPrefix));
    } else if (isArrow) {
      const maxArrowFunctionCharacterLength = 60;
      let abbreviation: string = text;
      if (defaultName) {
        abbreviation = defaultName + '()';
      } else if (text.length > maxArrowFunctionCharacterLength) {
        abbreviation = text.substring(0, firstArrowIndex + 2) + ' {…}';
      }
      addElements('', text, abbreviation);
    } else {
      addElements('\u0192', text, nameAndArguments(text));
    }
    UI.Tooltip.Tooltip.install(valueElement, Platform.StringUtilities.trimEndWithMaxLength(description, 500));
    return valueElement;

    function nameAndArguments(contents: string): string {
      const startOfArgumentsIndex = contents.indexOf('(');
      const endOfArgumentsMatch = contents.match(/\)\s*{/);
      if (startOfArgumentsIndex !== -1 && endOfArgumentsMatch && endOfArgumentsMatch.index !== undefined &&
        endOfArgumentsMatch.index > startOfArgumentsIndex) {
        const name = contents.substring(0, startOfArgumentsIndex).trim() || defaultName;
        const args = contents.substring(startOfArgumentsIndex, endOfArgumentsMatch.index + 1);
        return name + args;
      }
      return defaultName + '()';
    }

    function addElements(prefix: string, body: string, abbreviation: string): void {
      const maxFunctionBodyLength = 200;
      if (prefix.length) {
        valueElement.createChild('span', 'object-value-function-prefix').textContent = prefix + ' ';
      }
      if (includePreview) {
        UI.UIUtils.createTextChild(
          valueElement, Platform.StringUtilities.trimEndWithMaxLength(body.trim(), maxFunctionBodyLength));
      } else {
        UI.UIUtils.createTextChild(valueElement, abbreviation.replace(/\n/g, ' '));
      }
    }
  }

  static createPropertyValueWithCustomSupport(
    value: SDK.RemoteObject.RemoteObject,
    wasThrown: boolean,
    showPreview: boolean,
    parentElement?: Element,
    linkifier?: Components.Linkifier.Linkifier
  ): ObjectPropertyValue {
    if (value.customPreview()) {
      const result = (new CustomPreviewComponent(value)).element;
      result.classList.add('object-properties-section-custom-section');
      return new ObjectPropertyValue(result);
    }
    // COHERENT_BEGIN
    return BindObjectPropertiesSection.createPropertyValue(value, wasThrown, showPreview, parentElement, linkifier);
    // COHERENT_END
  }

  static appendMemoryIcon(element: Element, obj: SDK.RemoteObject.RemoteObject): void {
    // We show the memory icon only on ArrayBuffer and WebAssembly.Memory instances.
    // TypedArrays DataViews are also supported, but showing the icon next to their
    // previews is quite a significant visual overhead, and users can easily get to
    // their buffers and open the memory inspector from there.
    if (obj.type !== 'object' || (obj.subtype !== 'arraybuffer' && obj.subtype !== 'webassemblymemory')) {
      return;
    }
    const memoryIcon = new IconButton.Icon.Icon();
    memoryIcon.data = {
      iconName: 'ic_memory_16x16',
      color: 'var(--color-text-secondary)',
      width: '13px',
      height: '13px',
    };
    memoryIcon.onclick = (event: MouseEvent): void => {
      Host.userMetrics.linearMemoryInspectorRevealedFrom(Host.UserMetrics.LinearMemoryInspectorRevealedFrom.MemoryIcon);
      LinearMemoryInspector.LinearMemoryInspectorController.LinearMemoryInspectorController.instance()
        .openInspectorView(obj);
      event.stopPropagation();
    };
    UI.Tooltip.Tooltip.install(memoryIcon, 'Reveal in Memory Inspector panel');
    element.classList.add('object-value-with-memory-icon');
    element.appendChild(memoryIcon);
  }

  static createPropertyValue(
    value: SDK.RemoteObject.RemoteObject,
    wasThrown: boolean,
    showPreview: boolean,
    parentElement?: Element,
    linkifier?: Components.Linkifier.Linkifier
  ): ObjectPropertyValue {
    let propertyValue;
    const type = value.type;
    const subtype = value.subtype;
    const description = value.description || '';
    const className = value.className;
    if (type === 'object' && subtype === 'internal#location') {
      const rawLocation = value.debuggerModel().createRawLocationByScriptId(
        value.value.scriptId, value.value.lineNumber, value.value.columnNumber);
      if (rawLocation && linkifier) {
        return new ObjectPropertyValue(linkifier.linkifyRawLocation(rawLocation, ''));
      }
      propertyValue = new ObjectPropertyValue(createUnknownInternalLocationElement());
    } else if (type === 'string' && typeof description === 'string') {
      propertyValue = createStringElement();
    } else if (type === 'object' && subtype === 'trustedtype') {
      propertyValue = createTrustedTypeElement();
    } else if (type === 'function') {
      // COHERENT_BEGIN
      propertyValue = new ObjectPropertyValue(BindObjectPropertiesSection.valueElementForFunctionDescription(description));
      // COHERENT_END
    } else if (type === 'object' && subtype === 'node' && description) {
      propertyValue = new ObjectPropertyValue(createNodeElement());
    } else {
      const valueElement = document.createElement('span');
      valueElement.classList.add('object-value-' + (subtype || type));
      if (value.preview && showPreview) {
        const previewFormatter = new RemoteObjectPreviewFormatter();
        previewFormatter.appendObjectPreview(valueElement, value.preview, false /* isEntry */);
        propertyValue = new ObjectPropertyValue(valueElement);
        UI.Tooltip.Tooltip.install(propertyValue.element as HTMLElement, description || '');
      } else if (description.length > maxRenderableStringLength) {
        propertyValue = new ExpandableTextPropertyValue(valueElement, description, EXPANDABLE_MAX_LENGTH);
      } else {
        propertyValue = new ObjectPropertyValue(valueElement);
        propertyValue.element.textContent = description;
        UI.Tooltip.Tooltip.install(propertyValue.element as HTMLElement, description);
      }
      // COHERENT_BEGIN
      // this.appendMemoryIcon(valueElement, value);
      // COHERENT_END
    }

    if (wasThrown) {
      const wrapperElement = document.createElement('span');
      wrapperElement.classList.add('error');
      wrapperElement.classList.add('value');
      wrapperElement.appendChild(
        i18n.i18n.getFormatLocalizedString(str_, UIStrings.exceptionS, { PH1: propertyValue.element }));
      propertyValue.element = wrapperElement;
    }
    propertyValue.element.classList.add('value');
    return propertyValue;

    function createUnknownInternalLocationElement(): Element {
      const valueElement = document.createElement('span');
      valueElement.textContent = '<' + i18nString(UIStrings.unknown) + '>';
      UI.Tooltip.Tooltip.install(valueElement, description || '');
      return valueElement;
    }

    function createStringElement(): ObjectPropertyValue {
      const valueElement = document.createElement('span');
      valueElement.classList.add('object-value-string');
      const text = JSON.stringify(description);
      let propertyValue;
      if (description.length > maxRenderableStringLength) {
        propertyValue = new ExpandableTextPropertyValue(valueElement, text, EXPANDABLE_MAX_LENGTH);
      } else {
        UI.UIUtils.createTextChild(valueElement, text);
        propertyValue = new ObjectPropertyValue(valueElement);
        UI.Tooltip.Tooltip.install(valueElement, description);
      }
      return propertyValue;
    }

    function createTrustedTypeElement(): ObjectPropertyValue {
      const valueElement = document.createElement('span');
      valueElement.classList.add('object-value-trustedtype');
      const text = `${className} "${description}"`;
      let propertyValue;
      if (text.length > maxRenderableStringLength) {
        propertyValue = new ExpandableTextPropertyValue(valueElement, text, EXPANDABLE_MAX_LENGTH);
      } else {
        const contentString = createStringElement();
        UI.UIUtils.createTextChild(valueElement, `${className} `);
        valueElement.appendChild(contentString.element);
        propertyValue = new ObjectPropertyValue(valueElement);
        UI.Tooltip.Tooltip.install(valueElement, text);
      }

      return propertyValue;
    }

    function createNodeElement(): Element {
      const valueElement = document.createElement('span');
      valueElement.classList.add('object-value-node');
      createSpansForNodeTitle(valueElement, (description as string));
      valueElement.addEventListener('click', event => {
        Common.Revealer.reveal(value);
        event.consume(true);
      }, false);
      valueElement.addEventListener(
        'mousemove', () => SDK.OverlayModel.OverlayModel.highlightObjectAsDOMNode(value), false);
      valueElement.addEventListener('mouseleave', () => SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight(), false);
      return valueElement;
    }
  }

  static formatObjectAsFunction(
    func: SDK.RemoteObject.RemoteObject,
    element: Element,
    linkify: boolean,
    includePreview?: boolean
  ): Promise<void> {
    return func.debuggerModel().functionDetailsPromise(func).then(didGetDetails);

    function didGetDetails(response: SDK.DebuggerModel.FunctionDetails | null): void {
      if (linkify && response && response.location) {
        element.classList.add('linkified');
        element.addEventListener('click', () => {
          Common.Revealer.reveal(response.location);
          return false;
        });
      }

      // The includePreview flag is false for formats such as console.dir().
      let defaultName: string | ('' | 'anonymous') = includePreview ? '' : 'anonymous';
      if (response && response.functionName) {
        defaultName = response.functionName;
      }
      const valueElement =
        // COHERENT_BEGIN
        BindObjectPropertiesSection.valueElementForFunctionDescription(func.description, includePreview, defaultName);
      // COHERENT_END
      element.appendChild(valueElement);
    }
  }

  static isDisplayableProperty(
    property: SDK.RemoteObject.RemoteObjectProperty,
    parentProperty?: SDK.RemoteObject.RemoteObjectProperty
  ): boolean {
    if (!parentProperty || !parentProperty.synthetic) {
      return true;
    }
    const name = property.name;
    const useless = (parentProperty.name === '[[Entries]]' && (name === 'length' || name === '__proto__'));
    return !useless;
  }

  skipProto(): void {
    this.skipProtoInternal = true;
  }

  expand(): void {
    this.objectTreeElementInternal.expand();
  }

  setEditable(value: boolean): void {
    this.editable = value;
  }

  objectTreeElement(): UI.TreeOutline.TreeElement {
    return this.objectTreeElementInternal;
  }

  enableContextMenu(): void {
    this.element.addEventListener('contextmenu', this.contextMenuEventFired.bind(this), false);
  }

  private contextMenuEventFired(event: Event): void {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.appendApplicableItems(this.object);
    if (this.object instanceof SDK.RemoteObject.LocalJSONObject) {
      contextMenu.viewSection().appendItem(
        i18nString(UIStrings.expandRecursively),
        this.objectTreeElementInternal.expandRecursively.bind(this.objectTreeElementInternal, MAX_DEPTH));
      contextMenu.viewSection().appendItem(
        i18nString(UIStrings.collapseChildren),
        this.objectTreeElementInternal.collapseChildren.bind(this.objectTreeElementInternal));
    }
    contextMenu.show();
  }

  titleLessMode(): void {
    this.objectTreeElementInternal.listItemElement.classList.add('hidden');
    this.objectTreeElementInternal.childrenListElement.classList.add('title-less-mode');
    this.objectTreeElementInternal.expand();
  }
}

/** @const */
const ARRAY_LOAD_THRESHOLD = 100;

let maxRenderableStringLength = 10000;

export function setMaxRenderableStringLength(value: number): void {
  maxRenderableStringLength = value;
}
export function getMaxRenderableStringLength(): number {
  return maxRenderableStringLength;
}

export class ObjectPropertiesSectionsTreeOutline extends UI.TreeOutline.TreeOutlineInShadow {
  private readonly editable: boolean;
  constructor(options?: TreeOutlineOptions | null) {
    super();
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectValue.css');
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectPropertiesSection.css');
    this.registerRequiredCSS('ui/legacy/toolbar.css');
    this.editable = !(options && options.readOnly);
    this.contentElement.classList.add('source-code');
    this.contentElement.classList.add('object-properties-section');
    this.hideOverflow();
  }
}

export const enum ObjectPropertiesMode {
  All = 0,                         // All properties, including prototype properties
  OwnOnly = 1,                     // Own properties, excluding internal properties
  OwnAndInternalAndInherited = 2,  // Own, internal, and inherited properties
}

export class RootElement extends UI.TreeOutline.TreeElement {
  // COHERENT_BEGIN
  public modelName: string | null;
  // COHERENT_END
  private object: SDK.RemoteObject.RemoteObject | undefined;
  private readonly linkifier: Components.Linkifier.Linkifier | undefined;
  private readonly emptyPlaceholder: string | null | undefined;
  private readonly propertiesMode: ObjectPropertiesMode;
  private readonly extraProperties: SDK.RemoteObject.RemoteObjectProperty[];
  private readonly targetObject: SDK.RemoteObject.RemoteObject | undefined;
  toggleOnClick: boolean;
  constructor(
    // COHERENT_BEGIN
    modelName: string | null,
    object?: SDK.RemoteObject.RemoteObject, linkifier?: Components.Linkifier.Linkifier, emptyPlaceholder?: string | null,
    // COHERENT_END
    propertiesMode: ObjectPropertiesMode = ObjectPropertiesMode.OwnAndInternalAndInherited,
    extraProperties: SDK.RemoteObject.RemoteObjectProperty[] = [],
    // COHERENT_BEGIN
    targetObject: SDK.RemoteObject.RemoteObject | undefined = object) {
    // COHERENT_END
    const contentElement = document.createElement('slot');
    super(contentElement);

    // COHERENT_BEGIN
    this.modelName = modelName;
    // COHERENT_END
    this.object = object;
    this.linkifier = linkifier;
    this.emptyPlaceholder = emptyPlaceholder;
    this.propertiesMode = propertiesMode;
    this.extraProperties = extraProperties;
    this.targetObject = targetObject;

    this.setExpandable(true);
    this.selectable = true;
    this.toggleOnClick = true;
    this.listItemElement.classList.add('object-properties-section-root-element');
    this.listItemElement.addEventListener('contextmenu', this.onContextMenu.bind(this), false);
  }

  // COHERENT_BEGIN
  async update(modelName: string | null, object?: SDK.RemoteObject.RemoteObject) {
    this.modelName = modelName;
    this.object = object;

    // Only repopulate if we actually need to
    if (this.expanded) {
      const skipProto = true;

      await ObjectPropertyTreeElement.populateInPlace(
        this, this.object, skipProto, this.linkifier, this.emptyPlaceholder, this.propertiesMode, this.extraProperties,
        this.targetObject);
    }
  }
  // COHERENT_END

  onexpand(): void {
    if (this.treeOutline) {
      this.listItemElement.querySelector('.watch-expression-title .value')?.classList.add('hidden');
      this.treeOutline.element.classList.add('expanded');
    }
  }

  oncollapse(): void {
    if (this.treeOutline) {
      this.listItemElement.querySelector('.watch-expression-title .value')?.classList.remove('hidden');
      this.treeOutline.element.classList.remove('expanded');
    }
  }

  ondblclick(_e: Event): boolean {
    return true;
  }

  private onContextMenu(event: Event): void {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    // COHERENT_BEGIN
    if (this.object) contextMenu.appendApplicableItems(this.object);
    // COHERENT_END

    if (this.object instanceof SDK.RemoteObject.LocalJSONObject) {
      const { value } = this.object;
      const propertyValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
      const copyValueHandler = (): void => {
        Host.userMetrics.actionTaken(Host.UserMetrics.Action.NetworkPanelCopyValue);
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText((propertyValue as string | undefined));
      };
      contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyValue), copyValueHandler);
    }

    contextMenu.viewSection().appendItem(
      // COHERENT_BEGIN
      i18nString(UIStrings.expandRecursively), this.expandRecursively.bind(this, MAX_DEPTH));
    // COHERENT_END
    contextMenu.viewSection().appendItem(i18nString(UIStrings.collapseChildren), this.collapseChildren.bind(this));
    contextMenu.show();
  }

  // COHERENT_BEGIN
  async onpopulate(): Promise<void> {
    const skipProto = true;
    return ObjectPropertyTreeElement.populate(
      this, this.object, skipProto, this.linkifier, this.emptyPlaceholder, this.propertiesMode, this.extraProperties,
      this.targetObject);
  }
  // COHERENT_END
}

// Number of initially visible children in an ObjectPropertyTreeElement.
// Remaining children are shown as soon as requested via a show more properties button.
export const InitialVisibleChildrenLimit = 200;

export class ObjectPropertyTreeElement extends UI.TreeOutline.TreeElement {
  property: SDK.RemoteObject.RemoteObjectProperty;
  toggleOnClick: boolean;
  private highlightChanges: UI.UIUtils.HighlightChange[];
  private linkifier: Components.Linkifier.Linkifier | undefined;
  private readonly maxNumPropertiesToShow: number;
  nameElement!: HTMLElement;
  valueElement!: HTMLElement;
  private rowContainer!: HTMLElement;
  readOnly!: boolean;
  private prompt!: ObjectPropertyPrompt | undefined;
  private editableDiv!: HTMLElement;
  propertyValue?: ObjectPropertyValue;
  expandedValueElement?: Element | null;
  editIconElement!: UI.Toolbar.ToolbarButton;
  private onEditBlurInput: ((this: HTMLElement, ev: FocusEvent) => any) | null = null;

  constructor(property: SDK.RemoteObject.RemoteObjectProperty, linkifier?: Components.Linkifier.Linkifier) {
    // Pass an empty title, the title gets made later in onattach.
    super();

    this.property = property;
    this.toggleOnClick = true;
    this.highlightChanges = [];
    this.linkifier = linkifier;
    this.maxNumPropertiesToShow = InitialVisibleChildrenLimit;
    this.listItemElement.addEventListener('contextmenu', this.contextMenuFired.bind(this), false);
    this.listItemElement.dataset.objectPropertyNameForTest = property.name;

    this.editIconElement = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.edit), 'largeicon-edit');
    this.editIconElement.element.classList.add('edit-object-property', 'hidden');
    this.editIconElement.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.startEditing());
    this.listItemElement.appendChild(this.editIconElement.element);
  }

  // COHERENT_BEGIN
  static async getPropsFromValue(value: SDK.RemoteObject.RemoteObject, propertiesMode: ObjectPropertiesMode = ObjectPropertiesMode.OwnAndInternalAndInherited) {
    let properties, internalProperties = null;
    switch (propertiesMode) {
      case ObjectPropertiesMode.All:
        ({ properties } = await value.getAllProperties(false /* accessorPropertiesOnly */, true /* generatePreview */));
        break;
      case ObjectPropertiesMode.OwnOnly:
        ({ properties } = await value.getOwnProperties(true /* generatePreview */));
        break;
      case ObjectPropertiesMode.OwnAndInternalAndInherited:
        ({ properties, internalProperties } =
          await SDK.RemoteObject.RemoteObject.loadFromObjectPerProto(value, true /* generatePreview */));
        break;
    }

    return { properties, internalProperties };
  }

  static async populate(
    treeElement: UI.TreeOutline.TreeElement,
    value: SDK.RemoteObject.RemoteObject | undefined,
    skipProto: boolean,
    linkifier?: Components.Linkifier.Linkifier,
    emptyPlaceholder?: string | null,
    propertiesMode: ObjectPropertiesMode = ObjectPropertiesMode.OwnAndInternalAndInherited,
    extraProperties?: SDK.RemoteObject.RemoteObjectProperty[],
    targetValue?: SDK.RemoteObject.RemoteObject): Promise<void> {
    if (!value) return;
    if (value.arrayLength() > ARRAY_LOAD_THRESHOLD) {
      treeElement.removeChildren();
      ArrayGroupingTreeElement.populateArray(treeElement, value, 0, value.arrayLength() - 1, linkifier);
      return;
    }

    treeElement.removeChildren();

    const { properties, internalProperties } = await ObjectPropertyTreeElement.getPropsFromValue(value, propertiesMode);

    if (!properties) {
      return;
    }

    if (extraProperties !== undefined) {
      properties.push(...extraProperties);
    }

    ObjectPropertyTreeElement.populateWithProperties(
      treeElement, properties, internalProperties, skipProto, targetValue || value, linkifier, emptyPlaceholder,
      propertiesMode === ObjectPropertiesMode.OwnOnly);
  }

  static async populateInPlace(
    treeElement: UI.TreeOutline.TreeElement,
    value: SDK.RemoteObject.RemoteObject | undefined,
    skipProto: boolean,
    linkifier?: Components.Linkifier.Linkifier,
    emptyPlaceholder?: string | null,
    propertiesMode: ObjectPropertiesMode = ObjectPropertiesMode.OwnAndInternalAndInherited,
    extraProperties?: SDK.RemoteObject.RemoteObjectProperty[],
    targetValue?: SDK.RemoteObject.RemoteObject): Promise<void> {
    if (!value) return;
    if (value.arrayLength() > ARRAY_LOAD_THRESHOLD) {
      treeElement.removeChildren();

      ArrayGroupingTreeElement.populateArray(treeElement, value, 0, value.arrayLength() - 1, linkifier);
      return;
    }

    const { properties, internalProperties } = await ObjectPropertyTreeElement.getPropsFromValue(value, propertiesMode);

    if (!properties) {
      return;
    }

    if (extraProperties !== undefined) {
      properties.push(...extraProperties);
    }

    await ObjectPropertyTreeElement.updateOrPopulateProperties(
      treeElement, properties, internalProperties, skipProto, targetValue || value, linkifier, emptyPlaceholder,
      propertiesMode === ObjectPropertiesMode.OwnOnly);
  }

  private static async updateOrPopulateProperties(
    treeElement: UI.TreeOutline.TreeElement,
    properties: SDK.RemoteObject.RemoteObjectProperty[],
    internalProperties: SDK.RemoteObject.RemoteObjectProperty[] | null,
    skipProto: boolean,
    value: SDK.RemoteObject.RemoteObject,
    linkifier?: Components.Linkifier.Linkifier,
    emptyPlaceholder?: string | null,
    skipGetSet?: boolean
  ): Promise<void> {
    internalProperties = internalProperties || [];

    const existingChildren = new Map<string, ObjectPropertyTreeElement>();
    treeElement.children().forEach(child => {
      if (child instanceof ObjectPropertyTreeElement) {
        existingChildren.set(child.property.name, child);
      }
    });

    const toAdd: SDK.RemoteObject.RemoteObjectProperty[] = [];
    const toUpdate: [ObjectPropertyTreeElement, SDK.RemoteObject.RemoteObjectProperty][] = [];
    const toRemove = new Set(existingChildren.keys());

    const allProperties = [...properties, ...internalProperties];

    // Find properties to update or add
    for (const property of allProperties) {
      const existingElement = existingChildren.get(property.name);
      if (existingElement) {
        toUpdate.push([existingElement, property]);
        toRemove.delete(property.name);
      } else {
        toAdd.push(property);
      }
    }

    // Remove obsolete properties
    for (const name of toRemove) {
      const element = existingChildren.get(name);
      if (element) {
        treeElement.removeChild(element);
      }
    }

    // Update existing properties
    for (const [element, property] of toUpdate) {
      element.property = property;
      parentMap.set(property, value);
      await element.updateInPlace();
    }

    // Add new properties
    for (const property of toAdd) {
      if (property.name === '[[Entries]]') {
        continue;
      }
      if (property.name === '[[Prototype]]' && skipProto) {
        continue;
      }

      const prop = new ObjectPropertyTreeElement(property, linkifier);
      parentMap.set(property, value);
      treeElement.appendChild(prop);
    }

    ObjectPropertyTreeElement.appendEmptyPlaceholderIfNeeded(treeElement, emptyPlaceholder);
  }
  // COHERENT_END

  static populateWithProperties(
    treeNode: UI.TreeOutline.TreeElement,
    properties: SDK.RemoteObject.RemoteObjectProperty[],
    internalProperties: SDK.RemoteObject.RemoteObjectProperty[] | null,
    skipProto: boolean,
    value: SDK.RemoteObject.RemoteObject | null,
    linkifier?: Components.Linkifier.Linkifier,
    emptyPlaceholder?: string | null,
    skipGettersAndSetters?: boolean
  ): void {
    // COHERENT_BEGIN
    properties.sort(BindObjectPropertiesSection.compareProperties);
    // COHERENT_END
    internalProperties = internalProperties || [];

    const entriesProperty = internalProperties.find(property => property.name === '[[Entries]]');
    if (entriesProperty) {
      parentMap.set(entriesProperty, value);
      const treeElement = new ObjectPropertyTreeElement(entriesProperty, linkifier);
      treeElement.setExpandable(true);
      treeElement.expand();
      treeNode.appendChild(treeElement);
    }

    const tailProperties = [];
    for (let i = 0; i < properties.length; ++i) {
      const property = properties[i];
      parentMap.set(property, value);
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // COHERENT_BEGIN
      if (!BindObjectPropertiesSection.isDisplayableProperty(property, (treeNode as any).property)) {
        // COHERENT_END
        continue;
      }

      if (property.isOwn && !skipGettersAndSetters) {
        if (property.getter) {
          const getterProperty =
            new SDK.RemoteObject.RemoteObjectProperty('get ' + property.name, property.getter, false);
          parentMap.set(getterProperty, value);
          tailProperties.push(getterProperty);
        }
        if (property.setter) {
          const setterProperty =
            new SDK.RemoteObject.RemoteObjectProperty('set ' + property.name, property.setter, false);
          parentMap.set(setterProperty, value);
          tailProperties.push(setterProperty);
        }
      }

      const canShowProperty = property.getter || !property.isAccessorProperty();
      if (canShowProperty) {
        const element = new ObjectPropertyTreeElement(property, linkifier);
        if (property.name === 'memories' && property.value?.className === 'Memories') {
          element.updateExpandable();
          if (element.isExpandable()) {
            element.expand();
          }
        }
        treeNode.appendChild(element);
      }
    }
    for (let i = 0; i < tailProperties.length; ++i) {
      treeNode.appendChild(new ObjectPropertyTreeElement(tailProperties[i], linkifier));
    }

    for (const property of internalProperties) {
      parentMap.set(property, value);
      const treeElement = new ObjectPropertyTreeElement(property, linkifier);
      if (property.name === '[[Entries]]') {
        continue;
      }
      if (property.name === '[[Prototype]]' && skipProto) {
        continue;
      }
      treeNode.appendChild(treeElement);
    }

    ObjectPropertyTreeElement.appendEmptyPlaceholderIfNeeded(treeNode, emptyPlaceholder);
  }

  // COHERENT_BEGIN
  private static appendEmptyPlaceholderIfNeeded(treeNode: UI.TreeOutline.TreeElement, emptyPlaceholder?: string | null):
    void {
    const emptyPlaceholderElement = treeNode.listItemElement.querySelector('.gray-info-message');
    if (treeNode.childCount()) {
      if (emptyPlaceholderElement) emptyPlaceholderElement.classList.add('hidden');
      return;
    }

    if (emptyPlaceholderElement) emptyPlaceholderElement.classList.remove('hidden');
    else {
      const title = document.createElement('div');
      title.classList.add('gray-info-message');
      title.textContent = emptyPlaceholder || i18nString(UIStrings.noProperties);
      const infoElement = new UI.TreeOutline.TreeElement(title);
      treeNode.appendChild(infoElement);
    }
  }
  // COHERENT_END

  static createRemoteObjectAccessorPropertySpan(
    object: SDK.RemoteObject.RemoteObject | null,
    propertyPath: string[],
    callback: (arg0: SDK.RemoteObject.CallFunctionResult) => void
  ): HTMLElement {
    const rootElement = document.createElement('span');
    const element = rootElement.createChild('span');
    element.textContent = i18nString(UIStrings.dots);
    if (!object) {
      return rootElement;
    }
    element.classList.add('object-value-calculate-value-button');
    UI.Tooltip.Tooltip.install(element, i18nString(UIStrings.invokePropertyGetter));
    element.addEventListener('click', onInvokeGetterClick, false);

    function onInvokeGetterClick(event: Event): void {
      event.consume();
      if (object) {
        // The definition of callFunction expects an unknown, and setting to `any` causes Closure to fail.
        // However, leaving this as unknown also causes TypeScript to fail, so for now we leave this as unchecked.
        // @ts-ignore  TODO(crbug.com/1011811): Fix after Closure is removed.
        object.callFunction(invokeGetter, [{ value: JSON.stringify(propertyPath) }]).then(callback);
      }
    }

    function invokeGetter(this: Object, arrayStr: string): Object {
      let result: Object = this;
      const properties = JSON.parse(arrayStr);
      for (let i = 0, n = properties.length; i < n; ++i) {
        // @ts-ignore callFunction expects this to be a generic Object, so while this works we can't be more specific on types.
        result = result[properties[i]];
      }
      return result;
    }

    return rootElement;
  }

  setSearchRegex(regex: RegExp, additionalCssClassName?: string): boolean {
    let cssClasses = UI.UIUtils.highlightedSearchResultClassName;
    if (additionalCssClassName) {
      cssClasses += ' ' + additionalCssClassName;
    }
    this.revertHighlightChanges();

    this.applySearch(regex, this.nameElement, cssClasses);
    if (this.property.value) {
      const valueType = this.property.value.type;
      if (valueType !== 'object') {
        this.applySearch(regex, this.valueElement, cssClasses);
      }
    }

    return Boolean(this.highlightChanges.length);
  }

  private applySearch(regex: RegExp, element: Element, cssClassName: string): void {
    const ranges = [];
    const content = element.textContent || '';
    regex.lastIndex = 0;
    let match = regex.exec(content);
    while (match) {
      ranges.push(new TextUtils.TextRange.SourceRange(match.index, match[0].length));
      match = regex.exec(content);
    }
    if (ranges.length) {
      UI.UIUtils.highlightRangesWithStyleClass(element, ranges, cssClassName, this.highlightChanges);
    }
  }

  private showAllPropertiesElementSelected(element: UI.TreeOutline.TreeElement): boolean {
    this.removeChild(element);
    this.children().forEach(x => {
      x.hidden = false;
    });
    return false;
  }

  private createShowAllPropertiesButton(): void {
    const element = document.createElement('div');
    element.classList.add('object-value-calculate-value-button');
    element.textContent = i18nString(UIStrings.dots);
    UI.Tooltip.Tooltip.install(element, i18nString(UIStrings.showAllD, { PH1: this.childCount() }));
    const children = this.children();
    for (let i = this.maxNumPropertiesToShow; i < this.childCount(); ++i) {
      children[i].hidden = true;
    }
    const showAllPropertiesButton = new UI.TreeOutline.TreeElement(element);
    showAllPropertiesButton.onselect = this.showAllPropertiesElementSelected.bind(this, showAllPropertiesButton);
    this.appendChild(showAllPropertiesButton);
  }

  revertHighlightChanges(): void {
    UI.UIUtils.revertDomChanges(this.highlightChanges);
    this.highlightChanges = [];
  }

  async onpopulate(): Promise<void> {
    const propertyValue = (this.property.value as SDK.RemoteObject.RemoteObject);
    console.assert(typeof propertyValue !== 'undefined');
    // COHERENT_BEGIN
    const skipProto = true;
    const targetValue = this.property.name !== '[[Prototype]]' ? propertyValue : parentMap.get(this.property);
    if (targetValue) {
      await ObjectPropertyTreeElement.populate(
        this, propertyValue, skipProto, this.linkifier, undefined, undefined, undefined, targetValue);
      if (this.childCount() > this.maxNumPropertiesToShow) {
        this.createShowAllPropertiesButton();
      }
    }
    // COHERENT_END
  }

  ondblclick(event: Event): boolean {
    // COHERENT_BEGIN
    // Double-click is now disabled. Use the edit icon instead.
    // const target = (event.target as HTMLElement);
    // const inEditableElement = target.isSelfOrDescendant(this.valueElement) ||
    //   (this.expandedValueElement && target.isSelfOrDescendant(this.expandedValueElement));
    // if (this.property.value && !this.property.value.customPreview() && inEditableElement &&
    //   (this.property.writable || this.property.setter)) {
    //   this.startEditing();
    // }
    return false;
    // COHERENT_END
  }

  onenter(): boolean {
    // COHERENT_BEGIN
    if (this.property.value && !this.property.value.customPreview() &&
      (this.property.writable || this.property.setter) && this.isEditableProperty()) {
      this.startEditing();
      return true;
    }
    // COHERENT_END
    return false;
  }

  onattach(): void {
    this.update();
    this.updateExpandable();
  }

  onexpand(): void {
    this.showExpandedValueElement(true);
  }

  oncollapse(): void {
    this.showExpandedValueElement(false);
  }

  private showExpandedValueElement(value: boolean): void {
    if (!this.expandedValueElement) {
      return;
    }
    if (value) {
      this.rowContainer.replaceChild(this.expandedValueElement, this.valueElement);
    } else {
      this.rowContainer.replaceChild(this.valueElement, this.expandedValueElement);
    }
  }

  private createExpandedValueElement(value: SDK.RemoteObject.RemoteObject): Element | null {
    const needsAlternateValue = value.hasChildren && !value.customPreview() && value.subtype !== 'node' &&
      value.type !== 'function' && (value.type !== 'object' || value.preview);
    if (!needsAlternateValue) {
      const valueElement = document.createElement('span');
      valueElement.classList.add('value');
      return valueElement;
    }

    const valueElement = document.createElement('span');
    valueElement.classList.add('value');
    if (value.description === 'Object') {
      valueElement.textContent = '';
    } else {
      valueElement.setTextContentTruncatedIfNeeded(value.description || '');
    }
    valueElement.classList.add('object-value-' + (value.subtype || value.type));
    UI.Tooltip.Tooltip.install(valueElement, value.description || '');
    // COHERENT_BEGIN
    // BindObjectPropertiesSection.appendMemoryIcon(valueElement, value);
    // COHERENT_END
    return valueElement;
  }

  // COHERENT_BEGIN
  private updateExpandedValueElement(value: SDK.RemoteObject.RemoteObject): void {
    if (!this.expandedValueElement) {
      this.expandedValueElement = this.createExpandedValueElement(value);
      return;
    }

    const needsAlternateValue = value.hasChildren && !value.customPreview() && value.subtype !== 'node' &&
      value.type !== 'function' && (value.type !== 'object' || value.preview);
    if (!needsAlternateValue) {
      this.expandedValueElement = null;
      return;
    }

    this.expandedValueElement.classList.add('value');
    if (value.description === 'Object') {
      this.expandedValueElement.textContent = '';
    } else {
      this.expandedValueElement.setTextContentTruncatedIfNeeded(value.description || '');
    }
    this.expandedValueElement.classList.add('object-value-' + (value.subtype || value.type));
    UI.Tooltip.Tooltip.install(this.expandedValueElement as HTMLElement, value.description || '');
  }

  async updateInPlace(): Promise<void> {
    const propertyValue = this.property.value;
    if (!propertyValue || this.prompt) return;

    this.update();
    this.updateExpandable();
    if (this.expanded) await ObjectPropertyTreeElement.populateInPlace(this, propertyValue, true, this.linkifier);
    if (this.childCount() > this.maxNumPropertiesToShow) {
      this.createShowAllPropertiesButton();
    }
  }

  updateNameAndValueInPlace(): void {
    BindObjectPropertiesSection.updateNameElement(this.nameElement, this.property.name);

    this.valueElement.classList.remove('object-properties-section-dimmed', 'synthetic-property');

    if (!this.property.enumerable) {
      this.nameElement.classList.add('object-properties-section-dimmed');
    }
    if (this.property.synthetic) {
      this.nameElement.classList.add('synthetic-property');
    }

    this.updatePropertyPath();

    this.valueElement.classList.remove('value', 'object-value-undefined');

    const isInternalEntries = this.property.synthetic && this.property.name === '[[Entries]]';
    if (isInternalEntries) {
      this.valueElement.classList.add('value');
      this.valueElement.innerHTML = '';
    } else if (this.property.value) {
      const showPreview = this.property.name !== '[[Prototype]]';
      this.propertyValue = BindObjectPropertiesSection.createPropertyValueWithCustomSupport(
        this.property.value, this.property.wasThrown, showPreview, this.listItemElement, this.linkifier);
      this.valueElement = (this.propertyValue.element as HTMLElement);
    } else if (this.property.getter) {
      const remoteObjectAccessorSpan = ObjectPropertyTreeElement.createRemoteObjectAccessorPropertySpan(
        (parentMap.get(this.property) as SDK.RemoteObject.RemoteObject), [this.property.name],
        this.onInvokeGetterClick.bind(this));
      this.valueElement = remoteObjectAccessorSpan;
    } else {
      this.valueElement.classList.add('object-value-undefined');
      this.valueElement.innerHTML = i18nString(UIStrings.unreadable);
      UI.Tooltip.Tooltip.install(this.valueElement, i18nString(UIStrings.noPropertyGetter));
    }

    const valueText = this.valueElement.textContent;
    if (this.property.value && valueText && !this.property.wasThrown) {
      this.updateExpandedValueElement(this.property.value);
    }
  }
  // COHERENT_END

  update(): void {
    this.nameElement =
      // COHERENT_BEGIN
      (BindObjectPropertiesSection.createNameElement(this.property.name, this.property.private) as HTMLElement);
    // COHERENT_END
    if (!this.property.enumerable) {
      this.nameElement.classList.add('object-properties-section-dimmed');
    }
    if (this.property.synthetic) {
      this.nameElement.classList.add('synthetic-property');
    }

    this.updatePropertyPath();

    const isInternalEntries = this.property.synthetic && this.property.name === '[[Entries]]';
    if (isInternalEntries) {
      this.valueElement = document.createElement('span');
      this.valueElement.classList.add('value');
    } else if (this.property.value) {
      const showPreview = this.property.name !== '[[Prototype]]';
      // COHERENT_BEGIN
      this.propertyValue = BindObjectPropertiesSection.createPropertyValueWithCustomSupport(
        this.property.value, this.property.wasThrown, showPreview, this.listItemElement, this.linkifier);
      // COHERENT_END
      this.valueElement = (this.propertyValue.element as HTMLElement);
    } else if (this.property.getter) {
      this.valueElement = ObjectPropertyTreeElement.createRemoteObjectAccessorPropertySpan(
        (parentMap.get(this.property) as SDK.RemoteObject.RemoteObject), [this.property.name],
        this.onInvokeGetterClick.bind(this));
    } else {
      this.valueElement = document.createElement('span');
      this.valueElement.classList.add('object-value-undefined');
      this.valueElement.textContent = i18nString(UIStrings.unreadable);
      UI.Tooltip.Tooltip.install(this.valueElement, i18nString(UIStrings.noPropertyGetter));
    }

    const valueText = this.valueElement.textContent;
    if (this.property.value && valueText && !this.property.wasThrown) {
      this.expandedValueElement = this.createExpandedValueElement(this.property.value);
    }

    let container: Element;
    if (isInternalEntries) {
      container = UI.Fragment.html`<span class='name-and-value'>${this.nameElement}</span>`;
    } else {
      // COHERENT_BEGIN
      const nameValueSpan = document.createElement('span');
      nameValueSpan.classList.add('name-and-value');
      nameValueSpan.appendChild(this.nameElement);
      nameValueSpan.appendChild(document.createTextNode(': '));
      const displayElement = this.expanded && this.expandedValueElement ? this.expandedValueElement : this.valueElement;
      nameValueSpan.appendChild(displayElement);
      container = nameValueSpan;
      // COHERENT_END
    }

    if (this.rowContainer) this.listItemElement.removeChild(this.rowContainer);
    this.rowContainer = (container as HTMLElement);
    this.listItemElement.appendChild(this.rowContainer);
    this.editIconElement.element.classList.toggle('hidden', !this.isEditableProperty());
  }

  private updatePropertyPath(): void {
    if (this.nameElement.title) {
      return;
    }

    const name = this.property.name;

    if (this.property.synthetic) {
      UI.Tooltip.Tooltip.install(this.nameElement, name);
      return;
    }

    // https://tc39.es/ecma262/#prod-IdentifierName
    const useDotNotation = /^(?:[$_\p{ID_Start}])(?:[$_\u200C\u200D\p{ID_Continue}])*$/u;
    const isInteger = /^(?:0|[1-9]\d*)$/;

    const parentPath = (this.parent instanceof ObjectPropertyTreeElement && this.parent.nameElement &&
      !this.parent.property.synthetic) ?
      this.parent.nameElement.title :
      // COHERENT_BEGIN
      (this.parent instanceof RootElement ? this.parent.modelName : '');
    // COHERENT_END

    if (this.property.private || useDotNotation.test(name)) {
      UI.Tooltip.Tooltip.install(this.nameElement, parentPath ? `${parentPath}.${name}` : name);
    } else if (isInteger.test(name)) {
      UI.Tooltip.Tooltip.install(this.nameElement, `${parentPath}[${name}]`);
    } else {
      UI.Tooltip.Tooltip.install(this.nameElement, `${parentPath}[${JSON.stringify(name)}]`);
    }
  }

  private contextMenuFired(event: Event): void {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.appendApplicableItems(this);
    if (this.property.symbol) {
      contextMenu.appendApplicableItems(this.property.symbol);
    }
    if (this.property.value) {
      contextMenu.appendApplicableItems(this.property.value);
      if (parentMap.get(this.property) instanceof SDK.RemoteObject.LocalJSONObject) {
        const { value: { value } } = this.property;
        const propertyValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
        const copyValueHandler = (): void => {
          Host.userMetrics.actionTaken(Host.UserMetrics.Action.NetworkPanelCopyValue);
          Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText((propertyValue as string | undefined));
        };
        contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyValue), copyValueHandler);
      }
    }
    if (!this.property.synthetic && this.nameElement && this.nameElement.title) {
      const copyPathHandler = Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText.bind(
        Host.InspectorFrontendHost.InspectorFrontendHostInstance, this.nameElement.title);
      contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyPropertyPath), copyPathHandler);
    }
    if (parentMap.get(this.property) instanceof SDK.RemoteObject.LocalJSONObject) {
      contextMenu.viewSection().appendItem(
        // COHERENT_BEGIN
        i18nString(UIStrings.expandRecursively), this.expandRecursively.bind(this, MAX_DEPTH));
      // COHERENT_END
      contextMenu.viewSection().appendItem(i18nString(UIStrings.collapseChildren), this.collapseChildren.bind(this));
    }
    if (this.propertyValue) {
      this.propertyValue.appendApplicableItems(event, contextMenu, {});
    }
    contextMenu.show();
  }

  // COHERENT_BEGIN
  private isEditableProperty(): boolean {
    // Only allow editing primitive types: string, number, boolean
    // Deny editing: undefined, null, objects, functions, arrays
    if (!this.property.value) {
      return false;
    }

    const type = this.property.value.type;

    // Allow only string, number, and boolean types
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return true;
    }

    // Deny object, function, and any other types
    return false;
  }
  // COHERENT_END

  private startEditing(e?: Event): void {
    // COHERENT_BEGIN
    e?.stopPropagation();
    const treeOutline = (this.treeOutline as BindObjectPropertiesSection | null);
    // COHERENT_END
    if (this.prompt || !treeOutline || !treeOutline.editable || this.readOnly) {
      return;
    }
    this.editableDiv = (this.rowContainer.createChild('span', 'editable-div') as HTMLElement);

    if (this.property.value) {
      let text: string | (string | undefined) = this.property.value.description;
      if (this.property.value.type === 'string' && typeof text === 'string') {
        text = `"${text}"`;
      }

      this.editableDiv.setTextContentTruncatedIfNeeded(text, i18nString(UIStrings.stringIsTooLargeToEdit));
    }

    const originalContent = this.editableDiv.textContent || '';

    // Lie about our children to prevent expanding on double click and to collapse subproperties.
    this.setExpandable(false);
    this.listItemElement.classList.add('editing-sub-part');
    this.valueElement.classList.add('hidden');

    this.prompt = new ObjectPropertyPrompt();

    // COHERENT_BEGIN
    // Pass an empty callback - we'll handle blur on the input element instead
    const proxyElement =
      this.prompt.attachAndStartEditing(this.editableDiv);
    // COHERENT_END
    proxyElement.classList.add('property-prompt');

    const selection = this.listItemElement.getComponentSelection();

    if (selection) {
      selection.selectAllChildren(this.editableDiv);
    }

    // COHERENT_BEGIN
    // Attach handlers to the actual input element, not the wrapper
    const inputElement = proxyElement.querySelector('input') || proxyElement.querySelector('[contenteditable]');
    if (inputElement) {
      // Prevent mousedown from causing blur by stopping propagation
      inputElement.addEventListener('mousedown', (event: Event) => {
        event.stopPropagation();
      }, false);

      // Prevent click from propagating
      inputElement.addEventListener('click', (event: Event) => {
        event.stopPropagation();
      }, false);

      // Handle blur - only when truly losing focus (clicking outside)
      this.onEditBlurInput = this.editingCommitted.bind(this, originalContent);
      inputElement.addEventListener('blur', this.onEditBlurInput, false);
    }
    // COHERENT_END

    proxyElement.addEventListener('keydown', this.promptKeyDown.bind(this, originalContent), false);
  }

  private editingEnded(): void {
    if (this.prompt) {
      this.prompt.detach();
      delete this.prompt;
    }
    this.editableDiv.remove();
    this.updateExpandable();
    this.listItemElement.scrollLeft = 0;
    this.listItemElement.classList.remove('editing-sub-part');
    this.select();
  }

  private editingCancelled(): void {
    this.valueElement.classList.remove('hidden');
    this.editingEnded();
  }

  private async editingCommitted(originalContent: string): Promise<void> {
    const userInput = this.prompt ? this.prompt.text() : '';
    if (userInput === originalContent || userInput === '') {
      this.editingCancelled();  // nothing changed, so cancel
      return;
    }

    this.editingEnded();
    await this.updateBindModelValue(userInput);
  }

  private promptKeyDown(originalContent: string, event: Event): void {
    const inputElement = this.prompt?._proxyElement?.querySelector('input') || this.prompt?._proxyElement?.querySelector('[contenteditable]');
    const keyboardEvent = (event as KeyboardEvent);
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.consume();
      if (this.onEditBlurInput) {
        inputElement?.removeEventListener('blur', this.onEditBlurInput, false);
        this.onEditBlurInput = null;
      }
      this.editingCommitted(originalContent);
      return;
    }
    if (keyboardEvent.key === Platform.KeyboardUtilities.ESCAPE_KEY) {
      keyboardEvent.consume();
      if (this.onEditBlurInput) {
        inputElement?.removeEventListener('blur', this.onEditBlurInput, false);
        this.onEditBlurInput = null;
      }
      this.editingCancelled();
      return;
    }
  }

  // COHERENT_BEGIN
  private async updateBindModelValue(value: string) {
    value = JavaScriptREPL.wrapObjectLiteral(value.trim());

    const domModel = SDK.TargetManager.TargetManager.instance().mainTarget()?.model(SDK.DOMModel.DOMModel);
    const res = await domModel?.updateDataBindingValue(this.nameElement?.title, value);
    const hasError = res?.getError();
    const hasSucceeded = res?.succeeded;
    if (!hasError && hasSucceeded) {
      let root = this.parent;
      while (root && !(root instanceof RootElement)) {
        root = root.parent;
      }

      if (root) await updateBindModel(root.modelName!);
      let parsedValue: any;
      const trimmedValue = value.trim();

      try {
        parsedValue = JSON.parse(trimmedValue);
      } catch {
        if (trimmedValue === 'null') {
          parsedValue = "null";
        } else if (trimmedValue === 'undefined') {
          parsedValue = "undefined";
        } else if (trimmedValue === 'true') {
          parsedValue = true;
        } else if (trimmedValue === 'false') {
          parsedValue = false;
        } else {
          parsedValue = trimmedValue;
        }
      }

      this.property.value = SDK.RemoteObject.RemoteObject.fromLocalObject(parsedValue);
    } else {
      Common.Console.Console.instance().error(i18nString(UIStrings.failedToEditModelProperty));
    }

    await this.updateInPlace();
  }
  // COHERENT_END

  private onInvokeGetterClick(result: SDK.RemoteObject.CallFunctionResult): void {
    if (!result.object) {
      return;
    }
    this.property.value = result.object;
    this.property.wasThrown = result.wasThrown || false;

    this.update();
    this.invalidateChildren();
    this.updateExpandable();
  }

  private updateExpandable(): void {
    if (this.property.value) {
      this.setExpandable(
        !this.property.value.customPreview() && this.property.value.hasChildren && !this.property.wasThrown);
    } else {
      this.setExpandable(false);
    }
  }

  path(): string {
    return this.nameElement.title;
  }
}

export class ArrayGroupingTreeElement extends UI.TreeOutline.TreeElement {
  toggleOnClick: boolean;
  private readonly fromIndex: number;
  private readonly toIndex: number;
  private readonly object: SDK.RemoteObject.RemoteObject;
  private readonly readOnly: boolean;
  private readonly propertyCount: number;
  private readonly linkifier: Components.Linkifier.Linkifier | undefined;
  constructor(
    object: SDK.RemoteObject.RemoteObject, fromIndex: number, toIndex: number, propertyCount: number,
    linkifier?: Components.Linkifier.Linkifier) {
    super(Platform.StringUtilities.sprintf('[%d … %d]', fromIndex, toIndex), true);
    this.toggleOnClick = true;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
    this.object = object;
    this.readOnly = true;
    this.propertyCount = propertyCount;
    this.linkifier = linkifier;
  }

  static async populateArray(
    treeNode: UI.TreeOutline.TreeElement,
    object: SDK.RemoteObject.RemoteObject,
    fromIndex: number,
    toIndex: number,
    linkifier?: Components.Linkifier.Linkifier
  ): Promise<void> {
    await ArrayGroupingTreeElement.populateRanges(treeNode, object, fromIndex, toIndex, true, linkifier);
  }

  private static async populateRanges(
    treeNode: UI.TreeOutline.TreeElement,
    object: SDK.RemoteObject.RemoteObject,
    fromIndex: number,
    toIndex: number,
    topLevel: boolean,
    linkifier?: Components.Linkifier.Linkifier
  ): Promise<void> {
    // The definition of callFunctionJSON expects an unknown, and setting to `any` causes Closure to fail.
    // However, leaving this as unknown also causes TypeScript to fail, so for now we leave this as unchecked.
    // @ts-ignore  TODO(crbug.com/1011811): Fix after Closure is removed.
    const jsonValue = await object.callFunctionJSON(packRanges, [
      { value: fromIndex },
      { value: toIndex },
      { value: ArrayGroupingTreeElement.bucketThreshold },
      { value: ArrayGroupingTreeElement.sparseIterationThreshold },
      { value: ArrayGroupingTreeElement.getOwnPropertyNamesThreshold },
    ]);

    await callback(jsonValue);

    /**
     * Note: must declare params as optional.
     */
    function packRanges(
      this: Object,
      fromIndex?: number,
      toIndex?: number,
      bucketThreshold?: number,
      sparseIterationThreshold?: number,
      getOwnPropertyNamesThreshold?: number
    ): {
      ranges: number[][],
      skipGetOwnPropertyNames: boolean,
    } | undefined {
      if (fromIndex === undefined || toIndex === undefined || sparseIterationThreshold === undefined ||
        getOwnPropertyNamesThreshold === undefined || bucketThreshold === undefined) {
        return;
      }
      let ownPropertyNames: string[] | null = null;
      const consecutiveRange = (toIndex - fromIndex >= sparseIterationThreshold) && ArrayBuffer.isView(this);
      const skipGetOwnPropertyNames = consecutiveRange && (toIndex - fromIndex >= getOwnPropertyNamesThreshold);

      function* arrayIndexes(object: Object): Generator<number, void, unknown> {
        if (fromIndex === undefined || toIndex === undefined || sparseIterationThreshold === undefined ||
          getOwnPropertyNamesThreshold === undefined) {
          return;
        }

        if (toIndex - fromIndex < sparseIterationThreshold) {
          for (let i = fromIndex; i <= toIndex; ++i) {
            if (i in object) {
              yield i;
            }
          }
        } else {
          ownPropertyNames = ownPropertyNames || Object.getOwnPropertyNames(object);
          for (let i = 0; i < ownPropertyNames.length; ++i) {
            const name = ownPropertyNames[i];

            const index = Number(name) >>> 0;
            if ((String(index)) === name && fromIndex <= index && index <= toIndex) {
              yield index;
            }
          }
        }
      }

      let count = 0;
      if (consecutiveRange) {
        count = toIndex - fromIndex + 1;
      } else {
        for (const i of arrayIndexes(this))  // eslint-disable-line
          ++count;
      }

      let bucketSize: number = count;
      if (count <= bucketThreshold) {
        bucketSize = count;
      } else {
        bucketSize = Math.pow(bucketThreshold, Math.ceil(Math.log(count) / Math.log(bucketThreshold)) - 1);
      }

      const ranges = [];
      if (consecutiveRange) {
        for (let i = fromIndex; i <= toIndex; i += bucketSize) {
          const groupStart = i;
          let groupEnd: number = groupStart + bucketSize - 1;
          if (groupEnd > toIndex) {
            groupEnd = toIndex;
          }
          ranges.push([groupStart, groupEnd, groupEnd - groupStart + 1]);
        }
      } else {
        count = 0;
        let groupStart = -1;
        let groupEnd = 0;
        for (const i of arrayIndexes(this)) {
          if (groupStart === -1) {
            groupStart = i;
          }
          groupEnd = i;
          if (++count === bucketSize) {
            ranges.push([groupStart, groupEnd, count]);
            count = 0;
            groupStart = -1;
          }
        }
        if (count > 0) {
          ranges.push([groupStart, groupEnd, count]);
        }
      }

      return { ranges: ranges, skipGetOwnPropertyNames: skipGetOwnPropertyNames };
    }

    async function callback(result: {
      ranges: Array<Array<number>>,
      skipGetOwnPropertyNames: boolean,
    } | undefined): Promise<void> {
      if (!result) {
        return;
      }
      const ranges = (result.ranges as number[][]);
      if (ranges.length === 1) {
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
        // @ts-ignore
        await ArrayGroupingTreeElement.populateAsFragment(treeNode, object, ranges[0][0], ranges[0][1], linkifier);
      } else {
        for (let i = 0; i < ranges.length; ++i) {
          const fromIndex = ranges[i][0];
          const toIndex = ranges[i][1];
          const count = ranges[i][2];
          if (fromIndex === toIndex) {
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // @ts-ignore
            await ArrayGroupingTreeElement.populateAsFragment(treeNode, object, fromIndex, toIndex, linkifier);
          } else {
            treeNode.appendChild(new ArrayGroupingTreeElement(object, fromIndex, toIndex, count, linkifier));
          }
        }
      }
      if (topLevel) {
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
        // @ts-ignore
        await ArrayGroupingTreeElement.populateNonIndexProperties(
          treeNode, object, result.skipGetOwnPropertyNames, linkifier);
      }
    }
  }

  private static async populateAsFragment(
    this: ArrayGroupingTreeElement,
    treeNode: UI.TreeOutline.TreeElement,
    object: SDK.RemoteObject.RemoteObject,
    fromIndex: number,
    toIndex: number,
    linkifier?: Components.Linkifier.Linkifier
  ): Promise<void> {
    // The definition of callFunction expects an unknown, and setting to `any` causes Closure to fail.
    // However, leaving this as unknown also causes TypeScript to fail, so for now we leave this as unchecked.
    const result = await object.callFunction(
      // @ts-ignore  TODO(crbug.com/1011811): Fix after Closure is removed.
      buildArrayFragment,
      [{ value: fromIndex }, { value: toIndex }, { value: ArrayGroupingTreeElement.sparseIterationThreshold }]);
    if (!result.object || result.wasThrown) {
      return;
    }
    const arrayFragment = result.object;
    const allProperties =
      await arrayFragment.getAllProperties(false /* accessorPropertiesOnly */, true /* generatePreview */);
    arrayFragment.release();
    const properties = allProperties.properties;
    if (!properties) {
      return;
    }
    // COHERENT_BEGIN
    properties.sort(BindObjectPropertiesSection.compareProperties);
    // COHERENT_END
    for (let i = 0; i < properties.length; ++i) {
      parentMap.set(properties[i], this.object);
      const childTreeElement = new ObjectPropertyTreeElement(properties[i], linkifier);
      childTreeElement.readOnly = true;
      treeNode.appendChild(childTreeElement);
    }

    function buildArrayFragment(
      this: {
        [x: number]: Object,
      },
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fromIndex?: number, toIndex?: number, sparseIterationThreshold?: number): any {
      const result = Object.create(null);

      if (fromIndex === undefined || toIndex === undefined || sparseIterationThreshold === undefined) {
        return;
      }

      if (toIndex - fromIndex < sparseIterationThreshold) {
        for (let i = fromIndex; i <= toIndex; ++i) {
          if (i in this) {
            result[i] = this[i];
          }
        }
      } else {
        const ownPropertyNames = Object.getOwnPropertyNames(this);
        for (let i = 0; i < ownPropertyNames.length; ++i) {
          const name = ownPropertyNames[i];
          const index = Number(name) >>> 0;
          if (String(index) === name && fromIndex <= index && index <= toIndex) {
            result[index] = this[index];
          }
        }
      }
      return result;
    }
  }

  private static async populateNonIndexProperties(
    this: ArrayGroupingTreeElement,
    treeNode: UI.TreeOutline.TreeElement,
    object: SDK.RemoteObject.RemoteObject,
    skipGetOwnPropertyNames: boolean,
    linkifier?: Components.Linkifier.Linkifier
  ): Promise<void> {
    // The definition of callFunction expects an unknown, and setting to `any` causes Closure to fail.
    // However, leaving this as unknown also causes TypeScript to fail, so for now we leave this as unchecked.
    // @ts-ignore  TODO(crbug.com/1011811): Fix after Closure is removed.
    const result = await object.callFunction(buildObjectFragment, [{ value: skipGetOwnPropertyNames }]);
    if (!result.object || result.wasThrown) {
      return;
    }
    const allProperties = await result.object.getOwnProperties(true /* generatePreview */);
    result.object.release();
    if (!allProperties.properties) {
      return;
    }
    const properties = allProperties.properties;
    // COHERENT_BEGIN
    properties.sort(BindObjectPropertiesSection.compareProperties);
    // COHERENT_END
    for (const property of properties) {
      parentMap.set(property, this.object);
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // COHERENT_BEGIN
      if (!BindObjectPropertiesSection.isDisplayableProperty(property, (treeNode as any).property)) {
        // COHERENT_END
        continue;
      }
      const childTreeElement = new ObjectPropertyTreeElement(property, linkifier);
      childTreeElement.readOnly = true;
      treeNode.appendChild(childTreeElement);
    }

    function buildObjectFragment(this: Object, skipGetOwnPropertyNames?: boolean): {
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
      __proto__: any,
    } {
      // @ts-ignore __proto__ exists on Object.
      const result = { __proto__: this.__proto__ };
      if (skipGetOwnPropertyNames) {
        return result;
      }
      const names = Object.getOwnPropertyNames(this);
      for (let i = 0; i < names.length; ++i) {
        const name = names[i];
        // Array index check according to the ES5-15.4.
        if (String(Number(name) >>> 0) === name && Number(name) >>> 0 !== 0xffffffff) {
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(this, name);
        if (descriptor) {
          Object.defineProperty(result, name, descriptor);
        }
      }
      return result;
    }
  }

  async onpopulate(): Promise<void> {
    if (this.propertyCount >= ArrayGroupingTreeElement.bucketThreshold) {
      await ArrayGroupingTreeElement.populateRanges(
        this, this.object, this.fromIndex, this.toIndex, false, this.linkifier);
      return;
    }
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // @ts-ignore
    await ArrayGroupingTreeElement.populateAsFragment(this, this.object, this.fromIndex, this.toIndex, this.linkifier);
  }

  onattach(): void {
    this.listItemElement.classList.add('object-properties-section-name');
  }

  private static bucketThreshold = 100;
  private static sparseIterationThreshold = 250000;
  private static getOwnPropertyNamesThreshold = 500000;
}

export class ObjectPropertyPrompt extends UI.TextPrompt.TextPrompt {
  constructor() {
    super();
    const javaScriptAutocomplete = JavaScriptAutocomplete.instance();
    this.initialize(javaScriptAutocomplete.completionsForTextInCurrentContext.bind(javaScriptAutocomplete));
  }
}

const sectionMap = new Map<RootElement, string>();

const cachedResultMap = new Map<UI.TreeOutline.TreeElement, string>();

export class ObjectPropertiesSectionsTreeExpandController {
  private readonly expandedProperties: Set<string>;
  constructor(treeOutline: UI.TreeOutline.TreeOutline) {
    this.expandedProperties = new Set();
    treeOutline.addEventListener(UI.TreeOutline.Events.ElementAttached, this.elementAttached, this);
    treeOutline.addEventListener(UI.TreeOutline.Events.ElementExpanded, this.elementExpanded, this);
    treeOutline.addEventListener(UI.TreeOutline.Events.ElementCollapsed, this.elementCollapsed, this);
  }

  watchSection(id: string, section: RootElement): void {
    sectionMap.set(section, id);

    if (this.expandedProperties.has(id)) {
      section.expand();
    }
  }

  stopWatchSectionsWithId(id: string): void {
    for (const property of this.expandedProperties) {
      if (property.startsWith(id + ':')) {
        this.expandedProperties.delete(property);
      }
    }
  }

  private elementAttached(event: Common.EventTarget.EventTargetEvent): void {
    const element = (event.data as UI.TreeOutline.TreeElement);
    if (element.isExpandable() && this.expandedProperties.has(this.propertyPath(element))) {
      element.expand();
    }
  }

  private elementExpanded(event: Common.EventTarget.EventTargetEvent): void {
    const element = (event.data as UI.TreeOutline.TreeElement);
    this.expandedProperties.add(this.propertyPath(element));
  }

  private elementCollapsed(event: Common.EventTarget.EventTargetEvent): void {
    const element = (event.data as UI.TreeOutline.TreeElement);
    this.expandedProperties.delete(this.propertyPath(element));
  }

  private propertyPath(treeElement: UI.TreeOutline.TreeElement): string {
    const cachedPropertyPath = cachedResultMap.get(treeElement);
    if (cachedPropertyPath) {
      return cachedPropertyPath;
    }

    let current: UI.TreeOutline.TreeElement = treeElement;
    let sectionRoot: UI.TreeOutline.TreeElement = current;
    if (!treeElement.treeOutline) {
      throw new Error('No tree outline available');
    }

    const rootElement = (treeElement.treeOutline.rootElement() as RootElement);
    let result;
    while (current !== rootElement) {
      let currentName = '';
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((current as any).property) {
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentName = (current as any).property.name;
      } else {
        currentName = typeof current.title === 'string' ? current.title : current.title.textContent || '';
      }

      result = currentName + (result ? '.' + result : '');
      sectionRoot = current;
      if (current.parent) {
        current = current.parent;
      }
    }
    const treeOutlineId = sectionMap.get((sectionRoot as RootElement));
    result = treeOutlineId + (result ? ':' + result : '');
    cachedResultMap.set(treeElement, result);
    return result;
  }
}
let rendererInstance: Renderer;

export class Renderer implements UI.UIUtils.Renderer {
  static instance(opts: { forceNew: boolean } = { forceNew: false }): Renderer {
    const { forceNew } = opts;
    if (!rendererInstance || forceNew) {
      rendererInstance = new Renderer();
    }
    return rendererInstance;
  }

  // COHERENT_BEGIN
  render(modelName: string, object: Object, options?: UI.UIUtils.Options): Promise<{
    // COHERENT_END
    node: Node,
    tree: UI.TreeOutline.TreeOutline | null,
  } | null> {
    if (!(object instanceof SDK.RemoteObject.RemoteObject)) {
      return Promise.reject(new Error('Can\'t render ' + object));
    }
    options = options || { title: undefined, editable: undefined };
    const title = options.title;
    // COHERENT_BEGIN
    const section = new BindObjectPropertiesSection(modelName, object, title);
    // COHERENT_END
    if (!title) {
      section.titleLessMode();
    }
    section.editable = Boolean(options.editable);
    return Promise.resolve(({ node: section.element, tree: section } as {
      node: Node,
      tree: UI.TreeOutline.TreeOutline | null,
    } | null));
  }
}

export class ObjectPropertyValue implements UI.ContextMenu.Provider {
  element: Element;
  constructor(element: Element) {
    this.element = element;
  }

  appendApplicableItems(_event: Event, _contextMenu: UI.ContextMenu.ContextMenu, _object: Object): void {
  }
}

export class ExpandableTextPropertyValue extends ObjectPropertyValue {
  private readonly text: string;
  private readonly maxLength: number;
  private expandElement: Element | null;
  private readonly maxDisplayableTextLength: number;
  private readonly expandElementText: Common.UIString.LocalizedString | undefined;
  private readonly copyButtonText: Common.UIString.LocalizedString;
  constructor(element: Element, text: string, maxLength: number) {
    // abbreviated text and expandable text controls are added as children to element
    super(element);
    const container = element.createChild('span');
    this.text = text;
    this.maxLength = maxLength;
    container.textContent = text.slice(0, maxLength);
    UI.Tooltip.Tooltip.install(container as HTMLElement, `${text.slice(0, maxLength)}…`);

    this.expandElement = container.createChild('span');
    this.maxDisplayableTextLength = 10000000;

    const byteCount = Platform.StringUtilities.countWtf8Bytes(text);
    const totalBytesText = Platform.NumberUtilities.bytesToString(byteCount);
    if (this.text.length < this.maxDisplayableTextLength) {
      this.expandElementText = i18nString(UIStrings.showMoreS, { PH1: totalBytesText });
      this.expandElement.setAttribute('data-text', this.expandElementText);
      this.expandElement.classList.add('expandable-inline-button');
      this.expandElement.addEventListener('click', this.expandText.bind(this));
      this.expandElement.addEventListener('keydown', (event: Event) => {
        const keyboardEvent = (event as KeyboardEvent);
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          this.expandText();
        }
      });
      UI.ARIAUtils.markAsButton(this.expandElement);
    } else {
      this.expandElement.setAttribute('data-text', i18nString(UIStrings.longTextWasTruncatedS, { PH1: totalBytesText }));
      this.expandElement.classList.add('undisplayable-text');
    }

    this.copyButtonText = i18nString(UIStrings.copy);
    const copyButton = container.createChild('span', 'expandable-inline-button');
    copyButton.setAttribute('data-text', this.copyButtonText);
    copyButton.addEventListener('click', this.copyText.bind(this));
    copyButton.addEventListener('keydown', (event: Event) => {
      const keyboardEvent = (event as KeyboardEvent);
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        this.copyText();
      }
    });
    UI.ARIAUtils.markAsButton(copyButton);
  }

  appendApplicableItems(_event: Event, contextMenu: UI.ContextMenu.ContextMenu, _object: Object): void {
    if (this.text.length < this.maxDisplayableTextLength && this.expandElement) {
      contextMenu.clipboardSection().appendItem(this.expandElementText || '', this.expandText.bind(this));
    }
    contextMenu.clipboardSection().appendItem(this.copyButtonText, this.copyText.bind(this));
  }

  private expandText(): void {
    if (!this.expandElement) {
      return;
    }

    if (this.expandElement.parentElement) {
      this.expandElement.parentElement.insertBefore(
        document.createTextNode(this.text.slice(this.maxLength)), this.expandElement);
    }
    this.expandElement.remove();
    this.expandElement = null;
  }

  private copyText(): void {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(this.text);
  }
}
export interface TreeOutlineOptions {
  readOnly?: boolean;
}
