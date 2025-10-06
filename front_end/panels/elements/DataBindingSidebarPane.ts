import * as UI from '../../ui/legacy/legacy.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Common from '../../core/common/common.js';
import { ElementsSidebarPane } from './ElementsSidebarPane.js';
import * as ElementsComponents from './components/components.js';

let dataBindingPanelViewInstance: DataBindingSidebarPane;

export class DataBindingSidebarPane extends ElementsSidebarPane {
  private dataBindingsPanel: HTMLElement;
  private selectedNode: HTMLElement;
  private treeOutline: UI.TreeOutline.TreeOutline;
  private bindingAttributes: SDK.DOMModel.Attribute[]

  constructor() {
    super(true);
    this.bindingAttributes = [];

    UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, this.doUpdate, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(
      SDK.DOMModel.DOMModel, SDK.DOMModel.Events.DocumentUpdated, this._documentUpdatedEvent, this);

    this.contentElement.classList.add('data-binding-panel-base');
    this.dataBindingsPanel = this.contentElement.createChild('div', 'data-bindings-panel');
    this.dataBindingsPanel.style.width = `100%`;
    this.selectedNode = document.createElement('div');
    // @ts-ignore
    this.selectedNode.style = "display:flex; flex-direction:column;"
    this.dataBindingsPanel.appendChild(this.selectedNode);

    const treeElement = this.contentElement.createChild('div', 'bind-tree');
    this.treeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    this.treeOutline.contentElement.classList.add('tree-outline');
    this.registerRequiredCSS('ui/legacy/treeoutline.css');
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectValue.css');
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectPropertiesSection.css');
    treeElement.appendChild(this.treeOutline.contentElement);

    this.populateTree();
    this.doUpdate();
  }

  populateTree() {
    this.treeOutline.removeChildren();

    this.bindingAttributes.forEach((attr) => {
      const propTree = new ElementsComponents.DataBindingProperty.DataBindPropertyTreeElement(
        {
          attributeName: attr.name,
          attributeValue: attr.value,
          mutators: [{
            evaluationNodes: [
              { evaluatableExpression: '{{value}}', evaluatedValue: '1', type: 'string' },
              { evaluatableExpression: '{{value1}}', evaluatedValue: 1, type: 'number' },
              { evaluatableExpression: '{{value2}}', evaluatedValue: { test: 1, test2: { test3: ['1', undefined, false, 2, ['3'], { 4: '5', test: [{ 1: { 5: [3, { 6: 7 }] } }] }] } }, type: 'object' },
              { evaluatableExpression: '{{value3}}', evaluatedValue: ["test", "test2"], type: 'array' },
              { evaluatableExpression: '{{value4}}', evaluatedValue: undefined, type: 'undefined' },
              { evaluatableExpression: '{{value4}}', evaluatedValue: true, type: 'boolean' },
            ]
          }]
        }
      );
      propTree.setExpandable(true);
      this.treeOutline.appendChild(propTree);
    })
  }

  _documentUpdatedEvent(event: Common.EventTarget.EventTargetEvent<SDK.DOMModel.DOMModel>): void {
    const domModel = event.data;
  }

  async doUpdate(): Promise<void> {
    if (!this.node()) {
      this.selectedNode.textContent = 'No node selected';
      return;
    }
    const attr = this.node()?.attributes();
    this.bindingAttributes = attr?.filter((attr) => attr.name.startsWith('data-bind') || attr.name.startsWith('data-meta-for')) || [];

    this.selectedNode.innerHTML = `<div>Selected: ${this.node()?.nodeName()} with id ${this.node()?.backendNodeId()}</div>`;
    this.populateTree();
  }

  modelAdded(domModel: SDK.DOMModel.DOMModel): void {
    const parentModel = domModel.parentModel();
    this.selectedNode.textContent = 'Model';
  }

  modelRemoved(domModel: SDK.DOMModel.DOMModel): void {

  }

  static instance(opts: {
    forceNew: boolean | null,
  } = { forceNew: null }): DataBindingSidebarPane {
    const { forceNew } = opts;
    if (!dataBindingPanelViewInstance || forceNew) {
      dataBindingPanelViewInstance = new DataBindingSidebarPane();
    }

    return dataBindingPanelViewInstance;
  }
}