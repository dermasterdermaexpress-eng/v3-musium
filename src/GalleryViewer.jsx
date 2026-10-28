import { useEffect, useRef } from 'react';
import { GalleryViewer as Viewer } from './GalleryViewer.js';

// Contoh: <GalleryViewer configUrl="/gallery/gallery.json" baseUrl="/gallery/" />
// joystick: 'auto' (muncul otomatis di layar sentuh) | true (selalu) | false (tidak pernah)
export default function GalleryViewer({ configUrl = '/gallery/gallery.json', baseUrl = '/gallery/', joystick = 'auto', style }) {
  const ref = useRef(null);
  useEffect(() => {
    let viewer, dead = false;
    fetch(configUrl).then(r => r.json()).then(cfg => {
      if (!dead) viewer = new Viewer(ref.current, cfg, { baseUrl, joystick });
    }).catch(e => console.error('Gagal memuat gallery.json', e));
    return () => { dead = true; if (viewer) viewer.dispose(); };
  }, [configUrl, baseUrl, joystick]);
  return <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 400, ...style }} />;
}
