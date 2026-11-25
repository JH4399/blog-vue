import './assets/main.css'
import './assets/modules.css'
import './assets/admin.css'
import './assets/minimal.css'
import './assets/notifications.css'
import './assets/motion.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import ErrorDialog from './components/ErrorDialog.vue'
import { installErrorHandlers, reportError } from './services/errors'

const app = createApp(App)
// A separate root keeps error feedback available if the main page fails to render.
const errorHost = document.createElement('div')
document.body.appendChild(errorHost)
createApp(ErrorDialog).mount(errorHost)
installErrorHandlers(app, router)

try {
  app.use(createPinia())
  app.use(router)
  router.isReady().then(() => app.mount('#app')).catch(error => reportError(error, { fallback: '页面初始化失败，请刷新页面后重试。' }))
} catch (error) { reportError(error, { message: '页面初始化失败，请刷新页面后重试。' }) }
