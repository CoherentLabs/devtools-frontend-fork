// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../../core/sdk/sdk.js';
import * as UI from '../../legacy.js';

export async function executeRuntimeScript(expression: string, objectGroup?: string) {
    const currentExecutionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
    if (currentExecutionContext) {
        return currentExecutionContext.evaluate(
            {
                expression,
                objectGroup,
                includeCommandLineAPI: false,
                silent: true,
                returnByValue: false,
                generatePreview: false,
                allowUnsafeEvalBlockedByCSP: undefined,
                disableBreaks: undefined,
                replMode: undefined,
                throwOnSideEffect: undefined,
                timeout: undefined,
            },
                  /* userGesture */ false,
                  /* awaitPromise */ false)
    }
    return null;
}

export async function unregisterBindModel(modelName: string, objectGroup?: string) {
    return executeRuntimeScript(`
        engine.unregisterModel(${modelName});
        engine.synchronizeModels();
    `, objectGroup);
}

export async function createBindModel(modelName: string, objectGroup?: string) {
    return executeRuntimeScript(`
        engine.createJSModel('${modelName}', {});
        engine.synchronizeModels();
    `, objectGroup);
}

export async function renameBindModel(newModelName: string, oldModelName: string, objectGroup?: string) {
    return executeRuntimeScript(`
        engine.createJSModel('${newModelName}', JSON.parse(JSON.stringify(${oldModelName})));
        engine.unregisterModel(${oldModelName});
        engine.synchronizeModels();
    `, objectGroup);
}

export async function updateBindModel(modelName: string, objectGroup?: string) {
    return executeRuntimeScript(`
        engine.updateWholeModel(${modelName});
        engine.synchronizeModels();
    `, objectGroup);
}