import 'fake-indexeddb/auto';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from '../dashboard/router';
import '../dashboard/styles/tokens.css';
import WebRoot from './WebRoot.vue';

const app = createApp(WebRoot);
app.use(createPinia());
app.use(router);
app.mount('#app');
