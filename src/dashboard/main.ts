import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { installStaleChunkReload } from '@shared/utils/staleChunkReload';
import './styles/tokens.css';

installStaleChunkReload();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
