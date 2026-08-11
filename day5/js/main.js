/* main.js — entry point. Wires the modules; owns no behaviour itself. */

import { initTheme } from './theme.js';
import { initRouter } from './router.js';
import { initComposer } from './composer.js';
import { initSpendChart } from './spend-chart.js';
import { initMeters } from './meters.js';
import { initReliability } from './reliability.js';
import { initWorkflowView } from './workflow-view.js';

initTheme();
const router = initRouter();
initComposer();
initSpendChart();
initMeters();
initReliability();
initWorkflowView(router);
