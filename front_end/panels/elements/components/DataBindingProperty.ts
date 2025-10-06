import * as UI from '../../../ui/legacy/legacy.js';
import * as ObjectUI from '../../../ui/legacy/components/object_ui/object_ui.js';
import * as SDK from '../../../core/sdk/sdk.js';
import * as Protocol from '../../../generated/protocol.js';

import dataBindingProperty from './dataBindingProperty.css.js';

interface DataBindNode {
  evaluatableExpression: string
  evaluatedValue: string | number | object | any
  type: 'string' | 'number' | 'object' | 'array' | 'undefined' | 'boolean'
  syncStatus?: boolean
  evaluationError?: string
}

interface MutatorData {
  parsingError?: string
  compilationError?: string
  evaluationNodes: DataBindNode[]
}

interface DataBindAttributeData {
  attributeName: string, attributeValue: string, mutators: MutatorData[]
}

export class DataBindNodeTreeElement extends UI.TreeOutline.TreeElement {
  private readonly node: DataBindNode
  constructor(node: DataBindNode) {
    super();
    this.node = node;
    this.listItemElement.classList.add('monospace');
    this.setDisableSelectFocus(true)
  }

  onattach(): void {
    this.update();
  }

  appendEvaluatableExpressionElement(): void {
    switch (this.node.type) {
      case 'string':
      case 'number':
      case 'undefined':
      case 'boolean':
        {
          const nameElement = document.createElement('span');
          nameElement.textContent = this.node.evaluatableExpression || null;
          nameElement.classList.add('object-value-string');
          this.listItemElement.appendChild(nameElement);
          this.listItemElement.createChild('span', 'separator').textContent = ':\xA0';
          const valueElement = document.createElement('span');
          valueElement.textContent = this.node.type === 'string' ? `"${this.node.evaluatedValue}"` : this.node.evaluatedValue;
          valueElement.classList.add('object-value-' + this.node.type);
          this.listItemElement.appendChild(valueElement);
          break;
        }
      case 'array':
      case 'object': {
        const object = SDK.RemoteObject.RemoteObject.fromLocalObject(this.node.evaluatedValue);
        console.log(object)

        const title = document.createElement('div');
        title.classList.add('name-and-value')
        const nameElement = document.createElement('span');
        nameElement.textContent = this.node.evaluatableExpression || null;
        nameElement.classList.add('object-value-string');
        title.appendChild(nameElement);
        title.createChild('span', 'separator').textContent = ':\xA0';
        const valueElement = document.createElement('span');
        valueElement.textContent = JSON.stringify(this.node.evaluatedValue);
        valueElement.classList.add('object-value-object');
        title.appendChild(valueElement);

        const tree = new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection(object, title, void 0, false);
        tree._renderSelection = false;
        //@ts-ignore
        // this.appendChild(tree);
        this.listItemElement.appendChild(tree.element);
        break;
      }
    }

  }

  private update(): void {
    this.listItemElement.removeChildren();

    this.appendEvaluatableExpressionElement();
  }
}

export class DataBindTreeElement extends UI.TreeOutline.TreeElement {
  constructor() {
    super('');
    this.setExpandable(true);
    this.setDisableSelectFocus(true)
  }

  static createExclamationMark(tooltip: string): Element {
    const exclamationElement = document.createElement('span', { is: 'dt-icon-label' }) as UI.UIUtils.DevToolsIconLabel;
    exclamationElement.type = 'smallicon-warning';
    UI.Tooltip.Tooltip.install(exclamationElement, tooltip);
    return exclamationElement;
  }

  appendNameElement(name: string): void {
    const nameElement = document.createElement('span');
    nameElement.textContent = name;
    nameElement.classList.add('name');
    this.listItemElement.appendChild(nameElement);
    this.listItemElement.insertBefore(DataBindTreeElement.createExclamationMark('Data binding warning'), this.listItemElement.firstChild);

  }

  appendValueElement(value: string): void {
    const nameElement = document.createElement('span');
    nameElement.textContent = value;
    nameElement.classList.add('object-value-string');
    this.listItemElement.appendChild(nameElement);
  }
}

export class DataBindPropertyTreeElement extends DataBindTreeElement {
  private readonly property: DataBindAttributeData;
  toggleOnClick: boolean;
  constructor(
    property: DataBindAttributeData) {
    super();

    this.property = property;
    this.toggleOnClick = true;

    this.listItemElement.classList.add('monospace');
  }

  onattach(): void {
    this.update();
  }

  private update(): void {
    this.listItemElement.removeChildren();

    this.appendNameElement(this.property.attributeName);

    this.listItemElement.createChild('span', 'separator').textContent = ':\xA0';

    this.appendValueElement(this.property.attributeValue);
    this.property.mutators.forEach((mutator) => {
      mutator.evaluationNodes.forEach((evalNode) => {
        const node = new DataBindNodeTreeElement(evalNode);
        this.appendChild(node);
      })
    })
  }
}