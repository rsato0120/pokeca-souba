/* 相場 — ウォッチリストの値動き通知用サービスワーカー。
 *
 * やることは2つだけ。プッシュを受けて通知を出すことと、通知を押されたら
 * そのカードのページを開くこと。オフラインキャッシュはしない
 * （価格は毎日変わるので、古い相場をキャッシュから見せる方が害になる）。
 */

self.addEventListener('install', () => {
  // 差し替えたらすぐ有効にする（古いSWが残って通知の文面だけ古いのを避ける）
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || '相場'
  const options = {
    body: payload.body || '',
    // アイコンはサイトのfaviconを流用（専用アイコンを足したらここを差し替える）
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || 'souba-alert',
    // 同じtagで届いた通知は上書きする（毎朝1通に保つ）
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/watchlist' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/watchlist'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // すでに開いているタブがあればそれを使い回す（タブが増え続けるのを防ぐ）
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
