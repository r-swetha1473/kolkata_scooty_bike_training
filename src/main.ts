import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

/** One reload after new deploy when cached shell loses hashed chunks (PWA / slow networks). */
let chunkReloadTried = false;
window.addEventListener('unhandledrejection', (event) => {
  const msg = String((event.reason && (event.reason as Error).message) || event.reason || '');
  if (
    !chunkReloadTried &&
    /Failed to fetch dynamically imported module|ChunkLoadError|loading chunk \d+/i.test(msg)
  ) {
    chunkReloadTried = true;
    event.preventDefault();
    window.location.reload();
  }
});

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi())
  ]
}).catch((err) => console.error('Bootstrap error', err));
