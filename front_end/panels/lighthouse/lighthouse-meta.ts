// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import * as UI from '../../ui/legacy/legacy.js';

// eslint-disable-next-line rulesdir/es_modules_import
import type * as Lighthouse from './lighthouse.js';

const UIStrings = {
  /**
  *@description Command for showing the 'Lighthouse' tool
  */
  showLighthouse: 'Show `Lighthouse`',
};

const str_ = i18n.i18n.registerUIStrings('panels/lighthouse/lighthouse-meta.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

let loadedLighthouseModule: (typeof Lighthouse|undefined);

async function loadLighthouseModule(): Promise<typeof Lighthouse> {
  if (!loadedLighthouseModule) {
    // Side-effect import resources in module.json
    await Root.Runtime.Runtime.instance().loadModulePromise('panels/lighthouse');
    loadedLighthouseModule = await import('./lighthouse.js');
  }
  return loadedLighthouseModule;
}

// COHERENT BEGIN

// UI.ViewManager.registerViewExtension({
//   location: UI.ViewManager.ViewLocationValues.PANEL,
//   id: 'lighthouse',
//   title: i18n.i18n.lockedLazyString('Lighthouse'),
//   commandPrompt: i18nLazyString(UIStrings.showLighthouse),
//   order: 90,
//   async loadView() {
//     const Lighthouse = await loadLighthouseModule();
//     return Lighthouse.LighthousePanel.LighthousePanel.instance();
//   },
//   tags: [
//     i18n.i18n.lockedLazyString('lighthouse'),
//     i18n.i18n.lockedLazyString('pwa'),
//   ],
// });

// COHERENT END
