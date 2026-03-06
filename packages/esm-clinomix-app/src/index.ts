/**
 * This is the entrypoint file of the application. It communicates the
 * important features of this microfrontend to the app shell. It
 * connects the app shell to the React application(s) that make up this
 * microfrontend.
 */
import {
  createDashboard,
  getAsyncLifecycle,
  getSyncLifecycle,
  defineConfigSchema,
  registerBreadcrumbs,
} from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { createDashboardLink } from './createDashboardLink';
import { dashboardMeta } from './dashboard.meta';

const moduleName = '@openmrs/esm-clinomix-app';

const options = {
  featureName: 'clinomix',
  moduleName,
};

/**
 * This tells the app shell how to obtain translation files: that they
 * are JSON files in the directory `../translations` (which you should
 * see in the directory structure).
 */
export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

/**
 * This function performs any setup that should happen at microfrontend
 * load-time (such as defining the config schema) and then returns an
 * object which describes how the React application(s) should be
 * rendered.
 */
export function startupApp() {
  const clinomixBasePath = `${window.spaBase}/home/clinomix`;
  defineConfigSchema(moduleName, configSchema);

  registerBreadcrumbs([
    {
      title: 'Clinomix',
      path: clinomixBasePath,
      parent: `${window.spaBase}/home`,
    },
  ]);
}

/**
 * This named export tells the app shell that the default export of `root.component.tsx`
 * should be rendered when the route matches `root`. The full route
 * will be `openmrsSpaBase() + 'root'`, which is usually
 * `/openmrs/spa/root`.
 */
export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const clinomixDashboardLink = getSyncLifecycle(createDashboardLink(dashboardMeta), options);

export const clinomixDashboard = getAsyncLifecycle(() => import('./clinomix.component'), options);
