import GalleryViewer from './GalleryViewer.jsx';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100dvh' }}>
      <GalleryViewer configUrl="/gallery/gallery.json" baseUrl="/gallery/" />
    </div>
  );
}
