// Copyright 2019 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import './RenderingOptions.js';
// COHERENT_BEGIN
import './CohtmlPanel.js';
import './DataBindingModelsPanel.js';
// COHERENT_END
import './InspectorMain.js';

import * as InspectorMain from './InspectorMain.js';
import * as RenderingOptions from './RenderingOptions.js';
// COHERENT_BEGIN
import * as CohtmlPanelView from './CohtmlPanel.js';
import * as DataBindingModelsPanelView from './DataBindingModelsPanel.js';
// COHERENT_END

export {
  InspectorMain,
  RenderingOptions,
  // COHERENT_BEGIN
  CohtmlPanelView,
  DataBindingModelsPanelView,
  // COHERENT_END
};
