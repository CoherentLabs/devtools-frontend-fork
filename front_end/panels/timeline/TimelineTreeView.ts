// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/* eslint-disable rulesdir/no_underscored_properties */

import * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as TimelineModel from '../../models/timeline_model/timeline_model.js';
import * as DataGrid from '../../ui/legacy/components/data_grid/data_grid.js';
import * as Components from '../../ui/legacy/components/utils/utils.js';
import * as UI from '../../ui/legacy/legacy.js';

import type {PerformanceModel} from './PerformanceModel.js';
import {TimelineRegExp} from './TimelineFilters.js';
import type {TimelineSelection} from './TimelinePanel.js';
import {TimelineUIUtils} from './TimelineUIUtils.js';

const UIStrings = {
  /**
  *@description Text for the performance of something
  */
  performance: 'Performance',
  /**
  *@description Text to filter result items
  */
  filter: 'Filter',
  /**
  *@description Time of a single activity, as opposed to the total time
  */
  selfTime: 'Self Time',
  /**
  *@description Text for the total time of something
  */
  totalTime: 'Total Time',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  activity: 'Activity',
  /**
  *@description Text of a DOM element in Timeline Tree View of the Performance panel
  */
  selectItemForDetails: 'Select item for details.',
  /**
  * @description This message is presented as a tooltip when developers investigate the performance
  * of a page. The tooltip alerts developers that some parts of code in execution were not optimized
  * (made to run faster) and that associated timing information must be considered with this in
  * mind. The placeholder text is the reason the code was not optimized.
  * @example {Optimized too many times} PH1
  */
  notOptimizedS: 'Not optimized: {PH1}',
  /**
  *@description Time in miliseconds
  *@example {30.1} PH1
  */
  fms: '{PH1} ms',
  /**
  *@description Number followed by percent sign
  *@example {20} PH1
  */
  percentPlaceholder: '{PH1} %',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  chromeExtensionsOverhead: '[`Chrome` extensions overhead]',
  /**
   * @description Text in Timeline Tree View of the Performance panel. The text is presented
   * when developers investigate the performance of a page. 'V8 Runtime' labels the time
   * spent in (i.e. runtime) the V8 JavaScript engine.
   */
  vRuntime: '[`V8` Runtime]',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  unattributed: '[unattributed]',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  javascript: 'JavaScript',
  /**
  *@description Text that refers to one or a group of webpages
  */
  page: 'Page',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  noGrouping: 'No Grouping',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  groupByActivity: 'Group by Activity',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  groupByCategory: 'Group by Category',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  groupByDomain: 'Group by Domain',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  groupByFrame: 'Group by Frame',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  groupBySubdomain: 'Group by Subdomain',
  /**
  *@description Text in Timeline Tree View of the Performance panel
  */
  groupByUrl: 'Group by URL',
  /**
  *@description Aria-label for grouping combo box in Timeline Details View
  */
  groupBy: 'Group by',
  /**
  *@description Aria-label for filter bar in Call Tree view
  */
  filterCallTree: 'Filter call tree',
  /**
  *@description Aria-label for the filter bar in Bottom-Up view
  */
  filterBottomup: 'Filter bottom-up',
  /**
  * @description Title of the sidebar pane in the Performance panel which shows the stack (call
  * stack) where the program spent the most time (out of all the call stacks) while executing.
  */
  heaviestStack: 'Heaviest stack',
  /**
  * @description Tooltip for the the Heaviest stack sidebar toggle in the Timeline Tree View of the
  * Performance panel. Command to open/show the sidebar.
  */
  showHeaviestStack: 'Show Heaviest stack',
  /**
  * @description Tooltip for the the Heaviest stack sidebar toggle in the Timeline Tree View of the
  * Performance panel. Command to close/hide the sidebar.
  */
  hideHeaviestStack: 'Hide Heaviest stack',
  /**
  *@description Data grid name for Timeline Stack data grids
  */
  timelineStack: 'Timeline Stack',
};
const str_ = i18n.i18n.registerUIStrings('panels/timeline/TimelineTreeView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
export class TimelineTreeView extends UI.Widget.VBox implements UI.SearchableView.Searchable {
  _model: PerformanceModel|null;
  _track: TimelineModel.TimelineModel.Track|null;
  _tree: TimelineModel.TimelineProfileTree.Node|null;
  _searchResults: TimelineModel.TimelineProfileTree.Node[];
  linkifier!: Components.Linkifier.Linkifier;
  dataGrid!: DataGrid.SortableDataGrid.SortableDataGrid<GridNode>;
  _lastHoveredProfileNode!: TimelineModel.TimelineProfileTree.Node|null;
  _textFilter!: TimelineRegExp;
  _taskFilter!: TimelineModel.TimelineModelFilter.ExclusiveNameFilter;
  _startTime!: number;
  _endTime!: number;
  splitWidget!: UI.SplitWidget.SplitWidget;
  detailsView!: UI.Widget.Widget;
  _searchableView!: UI.SearchableView.SearchableView;
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _currentThreadSetting?: Common.Settings.Setting<any>;
  _lastSelectedNode?: TimelineModel.TimelineProfileTree.Node|null;
  _textFilterUI?: UI.Toolbar.ToolbarInput;
  _root?: TimelineModel.TimelineProfileTree.Node;
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _currentResult?: any;

  constructor() {
    super();
    this._model = null;
    this._track = null;
    this._tree = null;
    this.element.classList.add('timeline-tree-view');

    this._searchResults = [];
  }

  static eventNameForSorting(event: SDK.TracingModel.Event): string {
    if (event.name === TimelineModel.TimelineModel.RecordType.JSFrame) {
      const data = event.args['data'];
      return data['functionName'] + '@' + (data['scriptId'] || data['url'] || '');
    }
    return event.name + ':@' + TimelineModel.TimelineProfileTree.eventURL(event);
  }

  setSearchableView(searchableView: UI.SearchableView.SearchableView): void {
    this._searchableView = searchableView;
  }

  setModel(model: PerformanceModel|null, track: TimelineModel.TimelineModel.Track|null): void {
    this._model = model;
    this._track = track;
    this.refreshTree();
  }

  getToolbarInputAccessiblePlaceHolder(): string {
    return '';
  }

  model(): PerformanceModel|null {
    return this._model;
  }

  init(): void {
    this.linkifier = new Components.Linkifier.Linkifier();

    this._taskFilter =
        new TimelineModel.TimelineModelFilter.ExclusiveNameFilter([TimelineModel.TimelineModel.RecordType.Task]);
    this._textFilter = new TimelineRegExp();

    this._currentThreadSetting = Common.Settings.Settings.instance().createSetting('timelineTreeCurrentThread', 0);
    this._currentThreadSetting.addChangeListener(this.refreshTree, this);

    const columns = ([] as DataGrid.DataGrid.ColumnDescriptor[]);
    this.populateColumns(columns);

    this.splitWidget = new UI.SplitWidget.SplitWidget(true, true, 'timelineTreeViewDetailsSplitWidget');
    const mainView = new UI.Widget.VBox();
    const toolbar = new UI.Toolbar.Toolbar('', mainView.element);
    toolbar.makeWrappable(true);
    this.populateToolbar(toolbar);

    this.dataGrid = new DataGrid.SortableDataGrid.SortableDataGrid({
      displayName: i18nString(UIStrings.performance),
      columns,
      refreshCallback: undefined,
      editCallback: undefined,
      deleteCallback: undefined,
    });
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SortingChanged, this._sortingChanged, this);
    this.dataGrid.element.addEventListener('mousemove', this._onMouseMove.bind(this), true);
    this.dataGrid.setResizeMethod(DataGrid.DataGrid.ResizeMethod.Last);
    this.dataGrid.setRowContextMenuCallback(this._onContextMenu.bind(this));
    this.dataGrid.asWidget().show(mainView.element);
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, this._updateDetailsForSelection, this);

    this.detailsView = new UI.Widget.VBox();
    this.detailsView.element.classList.add('timeline-details-view', 'timeline-details-view-body');
    this.splitWidget.setMainWidget(mainView);
    this.splitWidget.setSidebarWidget(this.detailsView);
    this.splitWidget.hideSidebar();
    this.splitWidget.show(this.element);
    this.splitWidget.addEventListener(UI.SplitWidget.Events.ShowModeChanged, this._onShowModeChanged, this);

    this._lastSelectedNode;
  }

  lastSelectedNode(): TimelineModel.TimelineProfileTree.Node|null|undefined {
    return this._lastSelectedNode;
  }

  updateContents(selection: TimelineSelection): void {
    this.setRange(selection.startTime(), selection.endTime());
  }

  setRange(startTime: number, endTime: number): void {
    this._startTime = startTime;
    this._endTime = endTime;
    this.refreshTree();
  }

  filters(): TimelineModel.TimelineModelFilter.TimelineModelFilter[] {
    return [this._taskFilter, this._textFilter, ...(this._model ? this._model.filters() : [])];
  }

  filtersWithoutTextFilter(): TimelineModel.TimelineModelFilter.TimelineModelFilter[] {
    return [this._taskFilter, ...(this._model ? this._model.filters() : [])];
  }

  textFilter(): TimelineRegExp {
    return this._textFilter;
  }

  _exposePercentages(): boolean {
    return false;
  }

  populateToolbar(toolbar: UI.Toolbar.Toolbar): void {
    const textFilterUI =
        new UI.Toolbar.ToolbarInput(i18nString(UIStrings.filter), this.getToolbarInputAccessiblePlaceHolder());
    textFilterUI.addEventListener(UI.Toolbar.ToolbarInput.Event.TextChanged, () => {
      const searchQuery = textFilterUI.value();
      this._textFilter.setRegExp(searchQuery ? createPlainTextSearchRegex(searchQuery, 'i') : null);
      this.refreshTree();
    }, this);
    this._textFilterUI = textFilterUI;
    toolbar.appendToolbarItem(textFilterUI);
  }

  _modelEvents(): SDK.TracingModel.Event[] {
    return this._track ? this._track.syncEvents() : [];
  }

  _onHover(_node: TimelineModel.TimelineProfileTree.Node|null): void {
  }

  _appendContextMenuItems(_contextMenu: UI.ContextMenu.ContextMenu, _node: TimelineModel.TimelineProfileTree.Node):
      void {
  }

  _linkifyLocation(event: SDK.TracingModel.Event): Element|null {
    if (!this._model) {
      return null;
    }
    const target = this._model.timelineModel().targetByEvent(event);
    if (!target) {
      return null;
    }
    const frame = TimelineModel.TimelineProfileTree.eventStackFrame(event);
    if (!frame) {
      return null;
    }
    return this.linkifier.maybeLinkifyConsoleCallFrame(target, frame);
  }

  selectProfileNode(treeNode: TimelineModel.TimelineProfileTree.Node, suppressSelectedEvent: boolean): void {
    const pathToRoot = [];
    let node: (TimelineModel.TimelineProfileTree.Node|null)|TimelineModel.TimelineProfileTree.Node = treeNode;
    for (; node; node = node.parent) {
      pathToRoot.push(node);
    }
    for (let i = pathToRoot.length - 1; i > 0; --i) {
      const gridNode = this.dataGridNodeForTreeNode(pathToRoot[i]);
      if (gridNode && gridNode.dataGrid) {
        gridNode.expand();
      }
    }
    const gridNode = this.dataGridNodeForTreeNode(treeNode);
    if (gridNode && gridNode.dataGrid) {
      gridNode.reveal();
      gridNode.select(suppressSelectedEvent);
    }
  }

  refreshTree(): void {
    this.linkifier.reset();
    this.dataGrid.rootNode().removeChildren();
    if (!this._model) {
      this._updateDetailsForSelection();
      return;
    }
    this._root = this._buildTree();
    const children = this._root.children();
    let maxSelfTime = 0;
    let maxTotalTime = 0;
    const totalUsedTime = this._root.totalTime - this._root.selfTime;
    for (const child of children.values()) {
      maxSelfTime = Math.max(maxSelfTime, child.selfTime);
      maxTotalTime = Math.max(maxTotalTime, child.totalTime);
    }
    for (const child of children.values()) {
      // Exclude the idle time off the total calculation.
      const gridNode = new TreeGridNode(child, totalUsedTime, maxSelfTime, maxTotalTime, this);
      this.dataGrid.insertChild(gridNode);
    }
    this._sortingChanged();
    this._updateDetailsForSelection();
    if (this._searchableView) {
      this._searchableView.refreshSearch();
    }
    const rootNode = this.dataGrid.rootNode();
    if (rootNode.children.length > 0) {
      rootNode.children[0].select(/* supressSelectedEvent */ true);
    }
  }

  _buildTree(): TimelineModel.TimelineProfileTree.Node {
    throw new Error('Not Implemented');
  }

  buildTopDownTree(doNotAggregate: boolean, groupIdCallback: ((arg0: SDK.TracingModel.Event) => string)|null):
      TimelineModel.TimelineProfileTree.Node {
    return new TimelineModel.TimelineProfileTree.TopDownRootNode(
        this._modelEvents(), this.filters(), this._startTime, this._endTime, doNotAggregate, groupIdCallback);
  }

  populateColumns(columns: DataGrid.DataGrid.ColumnDescriptor[]): void {
    columns.push(
        ({id: 'self', title: i18nString(UIStrings.selfTime), width: '120px', fixedWidth: true, sortable: true} as
         DataGrid.DataGrid.ColumnDescriptor));
    columns.push(
        ({id: 'total', title: i18nString(UIStrings.totalTime), width: '120px', fixedWidth: true, sortable: true} as
         DataGrid.DataGrid.ColumnDescriptor));
    columns.push(
        ({id: 'activity', title: i18nString(UIStrings.activity), disclosure: true, sortable: true} as
         DataGrid.DataGrid.ColumnDescriptor));
  }

  _sortingChanged(): void {
    const columnId = this.dataGrid.sortColumnId();
    if (!columnId) {
      return;
    }
    let sortFunction;
    switch (columnId) {
      case 'startTime':
        sortFunction = compareStartTime;
        break;
      case 'self':
        sortFunction = compareNumericField.bind(null, 'selfTime');
        break;
      case 'total':
        sortFunction = compareNumericField.bind(null, 'totalTime');
        break;
      case 'activity':
        sortFunction = compareName;
        break;
      default:
        console.assert(false, 'Unknown sort field: ' + columnId);
        return;
    }
    this.dataGrid.sortNodes(sortFunction, !this.dataGrid.isSortOrderAscending());

    function compareNumericField(
        field: string, a: DataGrid.SortableDataGrid.SortableDataGridNode<GridNode>,
        b: DataGrid.SortableDataGrid.SortableDataGridNode<GridNode>): number {
      const nodeA = (a as TreeGridNode);
      const nodeB = (b as TreeGridNode);
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (nodeA._profileNode as any)[field] - (nodeB._profileNode as any)[field];
    }

    function compareStartTime(
        a: DataGrid.SortableDataGrid.SortableDataGridNode<GridNode>,
        b: DataGrid.SortableDataGrid.SortableDataGridNode<GridNode>): number {
      const nodeA = (a as TreeGridNode);
      const nodeB = (b as TreeGridNode);
      const eventA = (nodeA._profileNode.event as SDK.TracingModel.Event);
      const eventB = (nodeB._profileNode.event as SDK.TracingModel.Event);
      return eventA.startTime - eventB.startTime;
    }

    function compareName(
        a: DataGrid.SortableDataGrid.SortableDataGridNode<GridNode>,
        b: DataGrid.SortableDataGrid.SortableDataGridNode<GridNode>): number {
      const nodeA = (a as TreeGridNode);
      const nodeB = (b as TreeGridNode);
      const eventA = (nodeA._profileNode.event as SDK.TracingModel.Event);
      const eventB = (nodeB._profileNode.event as SDK.TracingModel.Event);
      const nameA = TimelineTreeView.eventNameForSorting(eventA);
      const nameB = TimelineTreeView.eventNameForSorting(eventB);
      return nameA.localeCompare(nameB);
    }
  }

  _onShowModeChanged(): void {
    if (this.splitWidget.showMode() === UI.SplitWidget.ShowMode.OnlyMain) {
      return;
    }
    this._lastSelectedNode = undefined;
    this._updateDetailsForSelection();
  }

  _updateDetailsForSelection(): void {
    const selectedNode = this.dataGrid.selectedNode ? (this.dataGrid.selectedNode as TreeGridNode)._profileNode : null;
    if (selectedNode === this._lastSelectedNode) {
      return;
    }
    this._lastSelectedNode = selectedNode;
    if (this.splitWidget.showMode() === UI.SplitWidget.ShowMode.OnlyMain) {
      return;
    }
    this.detailsView.detachChildWidgets();
    this.detailsView.element.removeChildren();
    if (selectedNode && this._showDetailsForNode(selectedNode)) {
      return;
    }
    const banner = this.detailsView.element.createChild('div', 'full-widget-dimmed-banner');
    UI.UIUtils.createTextChild(banner, i18nString(UIStrings.selectItemForDetails));
  }

  _showDetailsForNode(_node: TimelineModel.TimelineProfileTree.Node): boolean {
    return false;
  }

  _onMouseMove(event: Event): void {
    const gridNode = event.target && (event.target instanceof Node) ?
        (this.dataGrid.dataGridNodeFromNode((event.target as Node))) :
        null;
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // @ts-expect-error
    const profileNode = gridNode && gridNode._profileNode;
    if (profileNode === this._lastHoveredProfileNode) {
      return;
    }
    this._lastHoveredProfileNode = profileNode;
    this._onHover(profileNode);
  }

  _onContextMenu(contextMenu: UI.ContextMenu.ContextMenu, eventGridNode: DataGrid.DataGrid.DataGridNode<GridNode>):
      void {
    const gridNode = (eventGridNode as GridNode);
    if (gridNode._linkElement && !contextMenu.containsTarget(gridNode._linkElement)) {
      contextMenu.appendApplicableItems(gridNode._linkElement);
    }
    const profileNode = gridNode._profileNode;
    if (profileNode) {
      this._appendContextMenuItems(contextMenu, profileNode);
    }
  }

  dataGridNodeForTreeNode(treeNode: TimelineModel.TimelineProfileTree.Node): GridNode|null {
    return profileNodeToTreeGridNode.get(treeNode) || null;
  }

  // UI.SearchableView.Searchable implementation

  searchCanceled(): void {
    this._searchResults = [];
    this._currentResult = 0;
  }

  performSearch(searchConfig: UI.SearchableView.SearchConfig, _shouldJump: boolean, _jumpBackwards?: boolean): void {
    this._searchResults = [];
    this._currentResult = 0;
    if (!this._root) {
      return;
    }
    const searchRegex = searchConfig.toSearchRegex();
    this._searchResults = this._root.searchTree(event => TimelineUIUtils.testContentMatching(event, searchRegex));
    this._searchableView.updateSearchMatchesCount(this._searchResults.length);
  }

  jumpToNextSearchResult(): void {
    if (!this._searchResults.length) {
      return;
    }
    this.selectProfileNode(this._searchResults[this._currentResult], false);
    this._currentResult = Platform.NumberUtilities.mod(this._currentResult + 1, this._searchResults.length);
  }

  jumpToPreviousSearchResult(): void {
    if (!this._searchResults.length) {
      return;
    }
    this.selectProfileNode(this._searchResults[this._currentResult], false);
    this._currentResult = Platform.NumberUtilities.mod(this._currentResult - 1, this._searchResults.length);
  }

  supportsCaseSensitiveSearch(): boolean {
    return true;
  }

  supportsRegexSearch(): boolean {
    return true;
  }
}

export class GridNode extends DataGrid.SortableDataGrid.SortableDataGridNode<GridNode> {
  _populated: boolean;
  _profileNode: TimelineModel.TimelineProfileTree.Node;
  _treeView: TimelineTreeView;
  _grandTotalTime: number;
  _maxSelfTime: number;
  _maxTotalTime: number;
  _linkElement: Element|null;

  constructor(
      profileNode: TimelineModel.TimelineProfileTree.Node, grandTotalTime: number, maxSelfTime: number,
      maxTotalTime: number, treeView: TimelineTreeView) {
    super(null, false);
    this._populated = false;
    this._profileNode = profileNode;
    this._treeView = treeView;
    this._grandTotalTime = grandTotalTime;
    this._maxSelfTime = maxSelfTime;
    this._maxTotalTime = maxTotalTime;
    this._linkElement = null;
  }

  createCell(columnId: string): HTMLElement {
    if (columnId === 'activity') {
      return this._createNameCell(columnId);
    }
    return this._createValueCell(columnId) || super.createCell(columnId);
  }

  _createNameCell(columnId: string): HTMLElement {
    const cell = this.createTD(columnId);
    const container = cell.createChild('div', 'name-container');
    const iconContainer = container.createChild('div', 'activity-icon-container');
    const icon = iconContainer.createChild('div', 'activity-icon');
    const name = container.createChild('div', 'activity-name');
    const event = this._profileNode.event;
    if (this._profileNode.isGroupNode()) {
      const treeView = (this._treeView as AggregatedTimelineTreeView);
      const info = treeView._displayInfoForGroupNode(this._profileNode);
      name.textContent = info.name;
      icon.style.backgroundColor = info.color;
      if (info.icon) {
        iconContainer.insertBefore(info.icon, icon);
      }
    } else if (event) {
      const data = event.args['data'];
      const deoptReason = data && data['deoptReason'];
      if (deoptReason) {
        container.createChild('div', 'activity-warning').title =
            i18nString(UIStrings.notOptimizedS, {PH1: deoptReason});
      }

      name.textContent = TimelineUIUtils.eventTitle(event);
      this._linkElement = this._treeView._linkifyLocation(event);
      if (this._linkElement) {
        container.createChild('div', 'activity-link').appendChild(this._linkElement);
      }
      const eventStyle = TimelineUIUtils.eventStyle(event);
      const eventCategory = eventStyle.category;
      UI.ARIAUtils.setAccessibleName(icon, eventCategory.title);
      icon.style.backgroundColor = eventCategory.color;
    }
    return cell;
  }

  _createValueCell(columnId: string): HTMLElement|null {
    if (columnId !== 'self' && columnId !== 'total' && columnId !== 'startTime') {
      return null;
    }

    let showPercents = false;
    let value: number;
    let maxTime: number|undefined;
    let event: SDK.TracingModel.Event|null;
    switch (columnId) {
      case 'startTime':
        event = this._profileNode.event;
        if (!this._treeView._model) {
          throw new Error('Unable to find model for tree view');
        }
        value = (event ? event.startTime : 0) - this._treeView._model.timelineModel().minimumRecordTime();
        break;
      case 'self':
        value = this._profileNode.selfTime;
        maxTime = this._maxSelfTime;
        showPercents = true;
        break;
      case 'total':
        value = this._profileNode.totalTime;
        maxTime = this._maxTotalTime;
        showPercents = true;
        break;
      default:
        return null;
    }
    const cell = this.createTD(columnId);
    cell.className = 'numeric-column';
    const textDiv = cell.createChild('div');
    textDiv.createChild('span').textContent = i18nString(UIStrings.fms, {PH1: value.toFixed(1)});

    if (showPercents && this._treeView._exposePercentages()) {
      textDiv.createChild('span', 'percent-column').textContent =
          i18nString(UIStrings.percentPlaceholder, {PH1: (value / this._grandTotalTime * 100).toFixed(1)});
    }
    if (maxTime) {
      textDiv.classList.add('background-percent-bar');
      cell.createChild('div', 'background-bar-container').createChild('div', 'background-bar').style.width =
          (value * 100 / maxTime).toFixed(1) + '%';
    }
    return cell;
  }
}

export class TreeGridNode extends GridNode {
  constructor(
      profileNode: TimelineModel.TimelineProfileTree.Node, grandTotalTime: number, maxSelfTime: number,
      maxTotalTime: number, treeView: TimelineTreeView) {
    super(profileNode, grandTotalTime, maxSelfTime, maxTotalTime, treeView);
    this.setHasChildren(this._profileNode.hasChildren());
    profileNodeToTreeGridNode.set(profileNode, this);
  }

  populate(): void {
    if (this._populated) {
      return;
    }
    this._populated = true;
    if (!this._profileNode.children) {
      return;
    }
    for (const node of this._profileNode.children().values()) {
      const gridNode =
          new TreeGridNode(node, this._grandTotalTime, this._maxSelfTime, this._maxTotalTime, this._treeView);
      this.insertChildOrdered(gridNode);
    }
  }

  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static readonly _gridNodeSymbol = Symbol('treeGridNode');
}

const profileNodeToTreeGridNode = new WeakMap<TimelineModel.TimelineProfileTree.Node, TreeGridNode>();

export class AggregatedTimelineTreeView extends TimelineTreeView {
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _groupBySetting: Common.Settings.Setting<any>;
  _stackView: TimelineStackView;
  _productByURLCache: Map<string, string>;
  _colorByURLCache: Map<string, string>;
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _executionContextNamesByOrigin: Map<any, any>;

  constructor() {
    super();
    this._groupBySetting = Common.Settings.Settings.instance().createSetting(
        'timelineTreeGroupBy', AggregatedTimelineTreeView.GroupBy.None);
    this._groupBySetting.addChangeListener(this.refreshTree.bind(this));
    this.init();
    this._stackView = new TimelineStackView(this);
    this._stackView.addEventListener(
        TimelineStackView.Events.SelectionChanged, this._onStackViewSelectionChanged, this);
    this._productByURLCache = new Map();
    this._colorByURLCache = new Map();
    this._executionContextNamesByOrigin = new Map();
  }

  setModel(model: PerformanceModel|null, track: TimelineModel.TimelineModel.Track|null): void {
    super.setModel(model, track);
  }

  updateContents(selection: TimelineSelection): void {
    this._updateExtensionResolver();
    super.updateContents(selection);
    const rootNode = this.dataGrid.rootNode();
    if (rootNode.children.length) {
      rootNode.children[0].select(/* suppressSelectedEvent */ true);
    }
  }

  _updateExtensionResolver(): void {
    this._executionContextNamesByOrigin = new Map();
    for (const runtimeModel of SDK.TargetManager.TargetManager.instance().models(SDK.RuntimeModel.RuntimeModel)) {
      for (const context of runtimeModel.executionContexts()) {
        this._executionContextNamesByOrigin.set(context.origin, context.name);
      }
    }
  }

  _beautifyDomainName(this: AggregatedTimelineTreeView, name: string): string {
    if (AggregatedTimelineTreeView._isExtensionInternalURL(name)) {
      name = i18nString(UIStrings.chromeExtensionsOverhead);
    } else if (AggregatedTimelineTreeView._isV8NativeURL(name)) {
      name = i18nString(UIStrings.vRuntime);
    } else if (name.startsWith('chrome-extension')) {
      name = this._executionContextNamesByOrigin.get(name) || name;
    }
    return name;
  }

  _displayInfoForGroupNode(node: TimelineModel.TimelineProfileTree.Node): {
    name: string,
    color: string,
    icon: (Element|undefined),
  } {
    const categories = TimelineUIUtils.categories();
    const color =
        node.id ? TimelineUIUtils.eventColor((node.event as SDK.TracingModel.Event)) : categories['other'].color;
    const unattributed = i18nString(UIStrings.unattributed);

    const id = typeof node.id === 'symbol' ? undefined : node.id;

    switch (this._groupBySetting.get()) {
      case AggregatedTimelineTreeView.GroupBy.Category: {
        const category = id ? categories[id] || categories['other'] : {title: unattributed, color: unattributed};
        return {name: category.title, color: category.color, icon: undefined};
      }

      case AggregatedTimelineTreeView.GroupBy.Domain:
      case AggregatedTimelineTreeView.GroupBy.Subdomain: {
        const domainName = id ? this._beautifyDomainName(id) : undefined;
        return {name: domainName || unattributed, color: color, icon: undefined};
      }

      case AggregatedTimelineTreeView.GroupBy.EventName: {
        if (!node.event) {
          throw new Error('Unable to find event for group by operation');
        }
        const name = node.event.name === TimelineModel.TimelineModel.RecordType.JSFrame ?
            i18nString(UIStrings.javascript) :
            TimelineUIUtils.eventTitle(node.event);
        return {
          name: name,
          color: node.event.name === TimelineModel.TimelineModel.RecordType.JSFrame ?
              TimelineUIUtils.eventStyle(node.event).category.color :
              color,
          icon: undefined,
        };
      }

      case AggregatedTimelineTreeView.GroupBy.URL:
        break;

      case AggregatedTimelineTreeView.GroupBy.Frame: {
        if (!this._model) {
          throw new Error('Unable to find model for group by frame operation');
        }
        const frame = id ? this._model.timelineModel().pageFrameById(id) : undefined;
        const frameName = frame ? TimelineUIUtils.displayNameForFrame(frame, 80) : i18nString(UIStrings.page);
        return {name: frameName, color: color, icon: undefined};
      }

      default:
        console.assert(false, 'Unexpected grouping type');
    }
    return {name: id || unattributed, color: color, icon: undefined};
  }

  populateToolbar(toolbar: UI.Toolbar.Toolbar): void {
    super.populateToolbar(toolbar);
    const groupBy = AggregatedTimelineTreeView.GroupBy;
    const options = [
      {label: i18nString(UIStrings.noGrouping), value: groupBy.None},
      {label: i18nString(UIStrings.groupByActivity), value: groupBy.EventName},
      {label: i18nString(UIStrings.groupByCategory), value: groupBy.Category},
      {label: i18nString(UIStrings.groupByDomain), value: groupBy.Domain},
      {label: i18nString(UIStrings.groupByFrame), value: groupBy.Frame},
      {label: i18nString(UIStrings.groupBySubdomain), value: groupBy.Subdomain},
      {label: i18nString(UIStrings.groupByUrl), value: groupBy.URL},
    ];
    toolbar.appendToolbarItem(
        new UI.Toolbar.ToolbarSettingComboBox(options, this._groupBySetting, i18nString(UIStrings.groupBy)));
    toolbar.appendSpacer();
    toolbar.appendToolbarItem(this.splitWidget.createShowHideSidebarButton(
        i18nString(UIStrings.showHeaviestStack), i18nString(UIStrings.hideHeaviestStack)));
  }

  _buildHeaviestStack(treeNode: TimelineModel.TimelineProfileTree.Node): TimelineModel.TimelineProfileTree.Node[] {
    console.assert(Boolean(treeNode.parent), 'Attempt to build stack for tree root');
    let result: TimelineModel.TimelineProfileTree.Node[] = [];
    // Do not add root to the stack, as it's the tree itself.
    for (let node: TimelineModel.TimelineProfileTree.Node = treeNode; node && node.parent; node = node.parent) {
      result.push(node);
    }
    result = result.reverse();
    for (let node: TimelineModel.TimelineProfileTree.Node = treeNode;
         node && node.children() && node.children().size;) {
      const children = Array.from(node.children().values());
      node = children.reduce((a, b) => a.totalTime > b.totalTime ? a : b);
      result.push(node);
    }
    return result;
  }

  _exposePercentages(): boolean {
    return true;
  }

  _onStackViewSelectionChanged(): void {
    const treeNode = this._stackView.selectedTreeNode();
    if (treeNode) {
      this.selectProfileNode(treeNode, true);
    }
  }

  _showDetailsForNode(node: TimelineModel.TimelineProfileTree.Node): boolean {
    const stack = this._buildHeaviestStack(node);
    this._stackView.setStack(stack, node);
    this._stackView.show(this.detailsView.element);
    return true;
  }

  _groupingFunction(groupBy: string): ((arg0: SDK.TracingModel.Event) => string)|null {
    const GroupBy = AggregatedTimelineTreeView.GroupBy;
    switch (groupBy) {
      case GroupBy.None:
        return null;
      case GroupBy.EventName:
        return (event: SDK.TracingModel.Event): string => TimelineUIUtils.eventStyle(event).title;
      case GroupBy.Category:
        return (event: SDK.TracingModel.Event): string => TimelineUIUtils.eventStyle(event).category.name;
      case GroupBy.Subdomain:
        return this._domainByEvent.bind(this, false);
      case GroupBy.Domain:
        return this._domainByEvent.bind(this, true);
      case GroupBy.URL:
        return (event: SDK.TracingModel.Event): string => TimelineModel.TimelineProfileTree.eventURL(event) || '';
      case GroupBy.Frame:
        return (event: SDK.TracingModel.Event): string =>
                   TimelineModel.TimelineModel.TimelineData.forEvent(event).frameId;
      default:
        console.assert(false, `Unexpected aggregation setting: ${groupBy}`);
        return null;
    }
  }

  _domainByEvent(groupSubdomains: boolean, event: SDK.TracingModel.Event): string {
    const url = TimelineModel.TimelineProfileTree.eventURL(event);
    if (!url) {
      return '';
    }
    if (AggregatedTimelineTreeView._isExtensionInternalURL(url)) {
      return AggregatedTimelineTreeView._extensionInternalPrefix;
    }
    if (AggregatedTimelineTreeView._isV8NativeURL(url)) {
      return AggregatedTimelineTreeView._v8NativePrefix;
    }
    const parsedURL = Common.ParsedURL.ParsedURL.fromString(url);
    if (!parsedURL) {
      return '';
    }
    if (parsedURL.scheme === 'chrome-extension') {
      return parsedURL.scheme + '://' + parsedURL.host;
    }
    if (!groupSubdomains) {
      return parsedURL.host;
    }
    if (/^[.0-9]+$/.test(parsedURL.host)) {
      return parsedURL.host;
    }
    const domainMatch = /([^.]*\.)?[^.]*$/.exec(parsedURL.host);
    return domainMatch && domainMatch[0] || '';
  }

  _appendContextMenuItems(contextMenu: UI.ContextMenu.ContextMenu, node: TimelineModel.TimelineProfileTree.Node): void {
    if (this._groupBySetting.get() !== AggregatedTimelineTreeView.GroupBy.Frame) {
      return;
    }
    if (!node.isGroupNode()) {
      return;
    }
    if (!this._model) {
      return;
    }
    const frame = this._model.timelineModel().pageFrameById((node.id as string));
    if (!frame || !frame.ownerNode) {
      return;
    }
    contextMenu.appendApplicableItems(frame.ownerNode);
  }

  static _isExtensionInternalURL(url: string): boolean {
    return url.startsWith(AggregatedTimelineTreeView._extensionInternalPrefix);
  }

  static _isV8NativeURL(url: string): boolean {
    return url.startsWith(AggregatedTimelineTreeView._v8NativePrefix);
  }

  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static readonly _extensionInternalPrefix = 'extensions::';
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static readonly _v8NativePrefix = 'native ';
}
export namespace AggregatedTimelineTreeView {
  // TODO(crbug.com/1167717): Make this a const enum again
  // eslint-disable-next-line rulesdir/const_enum
  export enum GroupBy {
    None = 'None',
    EventName = 'EventName',
    Category = 'Category',
    Domain = 'Domain',
    Subdomain = 'Subdomain',
    URL = 'URL',
    Frame = 'Frame',
  }
}

export class CallTreeTimelineTreeView extends AggregatedTimelineTreeView {
  constructor() {
    super();
    this.dataGrid.markColumnAsSortedBy('total', DataGrid.DataGrid.Order.Descending);
  }

  getToolbarInputAccessiblePlaceHolder(): string {
    return i18nString(UIStrings.filterCallTree);
  }

  _buildTree(): TimelineModel.TimelineProfileTree.Node {
    const grouping = this._groupBySetting.get();
    return this.buildTopDownTree(false, this._groupingFunction(grouping));
  }
}

export class BottomUpTimelineTreeView extends AggregatedTimelineTreeView {
  constructor() {
    super();
    this.dataGrid.markColumnAsSortedBy('self', DataGrid.DataGrid.Order.Descending);
  }

  getToolbarInputAccessiblePlaceHolder(): string {
    return i18nString(UIStrings.filterBottomup);
  }

  _buildTree(): TimelineModel.TimelineProfileTree.Node {
    return new TimelineModel.TimelineProfileTree.BottomUpRootNode(
        this._modelEvents(), this.textFilter(), this.filtersWithoutTextFilter(), this._startTime, this._endTime,
        this._groupingFunction(this._groupBySetting.get()));
  }
}

export class TimelineStackView extends UI.Widget.VBox {
  _treeView: TimelineTreeView;
  _dataGrid: DataGrid.ViewportDataGrid.ViewportDataGrid<unknown>;

  constructor(treeView: TimelineTreeView) {
    super();
    const header = this.element.createChild('div', 'timeline-stack-view-header');
    header.textContent = i18nString(UIStrings.heaviestStack);
    this._treeView = treeView;
    const columns = ([
      {id: 'total', title: i18nString(UIStrings.totalTime), fixedWidth: true, width: '110px'},
      {id: 'activity', title: i18nString(UIStrings.activity)},
    ] as DataGrid.DataGrid.ColumnDescriptor[]);
    this._dataGrid = new DataGrid.ViewportDataGrid.ViewportDataGrid({
      displayName: i18nString(UIStrings.timelineStack),
      columns,
      deleteCallback: undefined,
      editCallback: undefined,
      refreshCallback: undefined,
    });
    this._dataGrid.setResizeMethod(DataGrid.DataGrid.ResizeMethod.Last);
    this._dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, this._onSelectionChanged, this);
    this._dataGrid.asWidget().show(this.element);
  }

  setStack(stack: TimelineModel.TimelineProfileTree.Node[], selectedNode: TimelineModel.TimelineProfileTree.Node):
      void {
    const rootNode = this._dataGrid.rootNode();
    rootNode.removeChildren();
    let nodeToReveal: GridNode|null = null;
    const totalTime = Math.max.apply(Math, stack.map(node => node.totalTime));
    for (const node of stack) {
      const gridNode = new GridNode(node, totalTime, totalTime, totalTime, this._treeView);
      rootNode.appendChild(gridNode);
      if (node === selectedNode) {
        nodeToReveal = gridNode;
      }
    }
    if (nodeToReveal) {
      nodeToReveal.revealAndSelect();
    }
  }

  selectedTreeNode(): TimelineModel.TimelineProfileTree.Node|null {
    const selectedNode = this._dataGrid.selectedNode;
    return selectedNode && (selectedNode as GridNode)._profileNode;
  }

  _onSelectionChanged(): void {
    this.dispatchEventToListeners(TimelineStackView.Events.SelectionChanged);
  }
}

export namespace TimelineStackView {
  // TODO(crbug.com/1167717): Make this a const enum again
  // eslint-disable-next-line rulesdir/const_enum
  export enum Events {
    SelectionChanged = 'SelectionChanged',
  }
}
