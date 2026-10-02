import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { catalog } from './catalog';
import './styles.css';

setupIonicReact();
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
async function request(path, options) {
  const response = await fetch(`${API}/api${path}`, options && { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}
const date = value => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
function Bee({ large = false }) { return <span className={large ? 'bee large' : 'bee'} aria-hidden="true">🐝</span>; }
function Species({ item, onOpen }) {
  return <button className="species-card" onClick={() => onOpen(item)}>
    <div className="species-art" style={{ '--species-color': item.color }}><span>{item.emoji}</span><Bee large /><span className="taxon-tag">{item.group}</span></div>
    <div className="species-copy"><small>{item.region}</small><h3>{item.name}</h3><i>{item.scientific}</i><p>{item.look}</p><span className="text-link">Conhecer esta abelha ↗</span></div>
  </button>;
}
function Modal({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Fechar" onClick={onClose}>×</button></div>{children}</dialog>;
}
async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('A foto deve ter no máximo 20 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  // Re-encode to remove EXIF metadata, including original GPS coordinates.
  return canvas.toDataURL('image/jpeg', 0.82);
}
function ObservationForm({ onClose, onSaved, nickname, setNickname }) {
  const [photo, setPhoto] = useState(''); const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('Você também pode informar somente a cidade.');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loadingPhoto, setLoadingPhoto] = useState(false); const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({ title: '', place: '', notes: '', taxon: '' });
  const field = event => setForm({ ...form, [event.target.name]: event.target.value });
  async function upload(event) {
    const file = event.target.files[0]; if (!file) return;
    setLoadingPhoto(true); setError('');
    try { setPhoto(await preparePhoto(file)); } catch (e) { setError(e.message); } finally { setLoadingPhoto(false); }
  }
  function locate() {
    if (!navigator.geolocation) return setLocationMessage('GPS indisponível. Informe sua cidade.');
    setLocating(true); setLocationMessage('Buscando localização…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ lat: Math.round(coords.latitude * 10) / 10, lng: Math.round(coords.longitude * 10) / 10 });
      setLocationMessage('Localização aproximada adicionada. O ponto exato não será salvo.'); setLocating(false);
    }, () => { setLocationMessage('Não foi possível acessar o GPS. Informe sua cidade ou tente novamente.'); setLocating(false); }, { timeout: 12000, maximumAge: 60000 });
  }
  async function submit(event) {
    event.preventDefault(); if (!photo) return setError('Adicione uma foto da observação.'); setBusy(true); setError('');
    try { const observation = await request('/observations', { method: 'POST', body: JSON.stringify({ ...form, author: nickname, photo, location }) }); onSaved(observation); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return <Modal title="Uma descoberta começa aqui" onClose={onClose}><p className="muted">Fotografe à distância, sem tocar na abelha ou perturbar o ninho.</p><form onSubmit={submit}>
    <label className="photo-upload">{photo ? <img src={photo} alt="Prévia da observação" /> : <><span>＋</span><strong>{loadingPhoto ? 'Preparando imagem…' : 'Adicionar foto'}</strong><small>JPG, PNG ou WebP · até 20 MB</small></>}<input aria-label="Foto da abelha" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={upload} disabled={loadingPhoto || busy} /></label>
    <div className="form-grid"><label>Seu nome ou apelido<input required maxLength={60} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Como quer aparecer?" /></label><label>Título da observação<input required name="title" value={form.title} onChange={field} maxLength={120} placeholder="Abelha nas flores do jardim" /></label></div>
    <label>Cidade / região<input required name="place" value={form.place} onChange={field} maxLength={120} placeholder="Ex.: Campinas, SP" /></label>
    <button type="button" className="button secondary" onClick={locate} disabled={locating}>◎ {locating ? 'Localizando…' : 'Usar localização aproximada'}</button><p className="small muted">{locationMessage} {location && <button className="text-link" type="button" onClick={() => { setLocation(null); setLocationMessage('Localização removida.'); }}>Remover ponto</button>}</p>
    <label>Sua sugestão de identificação<select name="taxon" value={form.taxon} onChange={field}><option value="">Não sei identificar ainda</option>{catalog.map(item => <option key={item.id} value={item.scientific}>{item.name} — {item.scientific}</option>)}</select></label>
    <label>O que você observou?<textarea name="notes" value={form.notes} onChange={field} maxLength={2000} rows={3} placeholder="Planta visitada, comportamento, horário… Não inclua endereço exato ou dados pessoais." /></label>
    <div className="notice">A IA ainda não está conectada. Sua sugestão será registrada como identificação do observador, aguardando revisão.</div>
    {error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={busy || loadingPhoto || locating}>{busy ? 'Salvando…' : 'Publicar observação ↗'}</button>
  </form></Modal>;
}
function ObservationDetail({ observation, onClose, onUpdate, nickname, setNickname }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function comment(event) { event.preventDefault(); setBusy(true); setError(''); try { onUpdate(await request(`/observations/${observation.id}/comments`, { method: 'POST', body: JSON.stringify({ author: nickname, text }) })); setText(''); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <Modal title={observation.title} onClose={onClose}><img className="detail-photo" src={observation.photo} alt={observation.title} /><p className="small muted">Por {observation.author} · {date(observation.createdAt)} · {observation.place}</p><span className="badge">{observation.status}</span><h3>{observation.taxon || 'Identificação em aberto'}</h3><p className="small muted">{observation.identificationSource}. Nenhuma identificação por IA foi realizada.</p><p className="preserve-lines">{observation.notes}</p>{observation.location && <p className="small muted">Ponto público aproximado: {observation.location.lat}, {observation.location.lng}</p>}<h3>Conversa da comunidade ({observation.comments.length})</h3>{observation.comments.length === 0 && <p className="muted">Compartilhe uma observação ou uma hipótese de identificação.</p>}{observation.comments.map(comment => <div className="comment" key={comment.id}><strong>{comment.author}</strong><small>{date(comment.createdAt)}</small><p>{comment.text}</p></div>)}<form onSubmit={comment}><label>Seu nome ou apelido<input required maxLength={60} value={nickname} onChange={e => setNickname(e.target.value)} /></label><label>Comentário<textarea required maxLength={1000} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Ajude a entender esta observação…" /></label>{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? 'Enviando…' : 'Comentar'}</button></form></Modal>;
}
function MapView({ observations, onSelect }) {
  const mapRef = useRef(); const container = useRef(); const points = observations.filter(item => item.location);
  useEffect(() => {
    const map = L.map(container.current, { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([-15.8, -47.9], 4); mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    return () => { map.stop(); map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const layer = L.layerGroup().addTo(mapRef.current);
    points.forEach(item => {
      const label = document.createElement('span'); label.textContent = `${item.title} — ${item.place}`;
      L.circleMarker([item.location.lat, item.location.lng], { radius: 10, color: '#173f35', weight: 2, fillColor: '#e9b946', fillOpacity: 0.9 }).bindTooltip(label).on('click', () => onSelect(item.id)).addTo(layer);
    });
    if (points.length) mapRef.current.fitBounds(points.map(item => [item.location.lat, item.location.lng]), { padding: [45, 45], maxZoom: 7, animate: false });
    return () => layer.remove();
  }, [observations, onSelect]);
  return <><div className="map" ref={container} aria-label="Mapa das observações com localização aproximada" /><p className="small muted">{points.length} registro(s) com localização. Os pontos são arredondados para 0,1°; não indicam a posição exata. O mapa-base precisa de internet.</p>{points.length === 0 && <div className="notice">O mapa está esperando sua primeira descoberta. Publique uma observação e permita a localização para adicionar um ponto.</div>}<div className="map-list">{points.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className="button secondary">◎ {item.title} · {item.place}</button>)}</div></>;
}
function App() {
  const [tab, setTab] = useState('home'); const [observations, setObservations] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const [search, setSearch] = useState(''); const [group, setGroup] = useState('Todas'); const [species, setSpecies] = useState(null); const [creating, setCreating] = useState(false); const [selected, setSelected] = useState(null); const [nickname, setNickname] = useState('');
  const selectedObservation = observations.find(item => item.id === selected);
  async function load() { setLoading(true); setError(''); try { setObservations(await request('/observations')); } catch { setError('Não foi possível acessar o servidor. Confirme que npm run dev está em execução e tente novamente.'); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  const filter = value => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filtered = catalog.filter(item => (group === 'Todas' || item.group === group) && filter(`${item.name} ${item.scientific} ${item.region}`).includes(filter(search)));
  function navigate(value) { setTab(value); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function update(item) { setObservations(current => current.map(old => old.id === item.id ? item : old)); }
  const cards = items => <div className="observation-grid">{items.map(item => <button className="observation-card" key={item.id} onClick={() => setSelected(item.id)}><img src={item.photo} alt={item.title} loading="lazy" /><div><span className="badge">{item.status}</span><h3>{item.title}</h3><p>{item.taxon || 'Identificação em aberto'}</p><small>◎ {item.place} · {date(item.createdAt)}</small><div className="card-bottom"><span>Por {item.author}</span><span>☏ {item.comments.length}</span></div></div></button>)}</div>;
  const empty = <div className="empty"><Bee large /><h3>Seu olhar pode ser o primeiro.</h3><p>Ainda não há observações. Registre uma abelha para começar o catálogo da comunidade.</p><button className="button" onClick={() => setCreating(true)}>Registrar uma abelha</button></div>;
  return <IonApp><div className="app-shell"><header><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('home'); }}><Bee /><span>Data<span className="brand-accent">Bee</span><small>CIÊNCIA QUE FLORESCE</small></span></a><nav aria-label="Navegação principal">{[['home','Início'],['catalog','Catálogo'],['feed','Comunidade'],['map','Mapa']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)} aria-current={tab === id ? 'page' : undefined}>{label}</button>)}</nav><button className="button header-cta" onClick={() => setCreating(true)}>＋ Registrar abelha</button></header>
    <main>{error && <div className="error-banner" role="alert">{error} <button onClick={load}>Tentar novamente</button></div>}
      {tab === 'home' && <><section className="hero"><div className="hero-copy"><span className="eyebrow">CIÊNCIA CIDADÃ · BIODIVERSIDADE</span><h1>Pequenas abelhas.<br /><em>Grandes descobertas.</em></h1><p>Conheça as abelhas ao seu redor e ajude a construir uma rede de conhecimento sobre nossos polinizadores.</p><div className="hero-actions"><button className="button" onClick={() => setCreating(true)}>Registrar uma descoberta ↗</button><button className="button ghost" onClick={() => navigate('catalog')}>Explorar catálogo</button></div><div className="hero-foot"><span className="dot" /> Um registro de cada vez. Uma comunidade inteira.</div></div><div className="hero-art" aria-label="Ilustração de uma abelha sobre flores"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="flower flower-one">✿</span><span className="flower flower-two">✿</span><span className="flower flower-three">✿</span><div className="hero-bee"><Bee large /></div><div className="floating-note"><span>◎</span><div><strong>Cada abelha conta</strong><small>Observe · registre · compartilhe</small></div></div><span className="art-caption">CONEXÕES QUE GERAM VIDA</span></div></section>
      <section className="stats"><div><strong>{observations.length.toString().padStart(2,'0')}</strong><span>observações registradas</span></div><div><strong>{catalog.length.toString().padStart(2,'0')}</strong><span>táxons no catálogo inicial</span></div><div><strong>{new Set(observations.map(item => item.author.trim().toLowerCase())).size.toString().padStart(2,'0')}</strong><span>nomes de observadores*</span></div><p>*Apelidos livres nesta versão local, sem contas verificadas.</p></section>
      <section className="section"><div className="section-head"><div><span className="eyebrow">UM UNIVERSO PARA CONHECER</span><h2>Encontre sua próxima descoberta</h2></div><button className="text-link" onClick={() => navigate('catalog')}>Ver catálogo completo ↗</button></div><div className="species-grid">{catalog.slice(0,3).map(item => <Species key={item.id} item={item} onOpen={setSpecies} />)}</div></section>
      <section className="how"><div><span className="eyebrow">DO SEU JARDIM PARA A CIÊNCIA</span><h2>Um pequeno gesto.<br />Uma contribuição real.</h2><p>Você não precisa conhecer a espécie para participar.</p></div><ol><li><span>01</span><div><h3>Observe com cuidado</h3><p>Mantenha distância e fotografe sem interferir.</p></div></li><li><span>02</span><div><h3>Registre o encontro</h3><p>Adicione a foto, a região e o que chamou sua atenção.</p></div></li><li><span>03</span><div><h3>Aprenda em comunidade</h3><p>Compartilhe hipóteses e converse sobre a identificação.</p></div></li></ol></section>
      <section className="section"><div className="section-head"><div><span className="eyebrow">OLHARES DA COMUNIDADE</span><h2>Últimas observações</h2></div><button className="text-link" onClick={() => navigate('feed')}>Explorar registros ↗</button></div>{loading ? <p role="status">Carregando observações…</p> : observations.length ? cards(observations.slice(0,3)) : error ? <p className="muted">Os registros aparecerão quando o servidor estiver disponível.</p> : empty}</section></>}
      {tab === 'catalog' && <section className="section page-section"><span className="eyebrow">CONHECER PARA PRESERVAR</span><h1>Catálogo de abelhas</h1><p className="page-intro">Um ponto de partida para explorar. Características visuais ajudam a observar, mas não substituem a identificação especializada.</p><div className="filters"><label className="search-label"><span className="sr-only">Buscar abelha</span><input placeholder="Buscar nome, gênero ou região…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="chips">{['Todas','Sem ferrão','Com ferrão','Solitária'].map(value => <button aria-pressed={group === value} className={group === value ? 'selected' : ''} key={value} onClick={() => setGroup(value)}>{value}</button>)}</div></div><p className="small muted">{filtered.length} resultado(s)</p><div className="species-grid">{filtered.map(item => <Species key={item.id} item={item} onOpen={setSpecies} />)}</div>{!filtered.length && <p className="empty">Nenhuma abelha encontrada. Tente outro termo.</p>}</section>}
      {tab === 'feed' && <section className="section page-section"><div className="section-head"><div><span className="eyebrow">CONHECIMENTO COMPARTILHADO</span><h1>Comunidade</h1><p className="page-intro">Encontros, descobertas e conversas sobre as abelhas.</p></div><button className="button" onClick={() => setCreating(true)}>＋ Nova observação</button></div><div className="notice">Protótipo local: nomes livres, sem autenticação. Todas as identificações aguardam revisão; a IA ainda não está conectada.</div>{loading ? <p role="status">Carregando…</p> : observations.length ? cards(observations) : !error && empty}</section>}
      {tab === 'map' && <section className="section page-section"><span className="eyebrow">UM TERRITÓRIO DE DESCOBERTAS</span><h1>Mapa das observações</h1><p className="page-intro">Explore registros da comunidade. Compartilhamos apenas posições aproximadas.</p><MapView observations={observations} onSelect={setSelected} /></section>}
    </main><footer><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('home'); }}><Bee /><span>DataBee</span></a><p>Observar. Conhecer. Preservar.</p><span>Primeira versão · ciência cidadã</span></footer>
    {creating && <ObservationForm nickname={nickname} setNickname={setNickname} onClose={() => setCreating(false)} onSaved={item => { setObservations(current => [item,...current]); setCreating(false); navigate('feed'); setToast('Observação publicada. Obrigado por contribuir!'); }} />}
    {species && <Modal title={species.name} onClose={() => setSpecies(null)}><div className="species-art detail-art" style={{ '--species-color': species.color }}><span>{species.emoji}</span><Bee large /></div><p><i>{species.scientific}</i> · {species.group}</p><p>{species.description}</p><h3>O que observar</h3><p>{species.look}</p><h3>Onde pode ser encontrada</h3><p>{species.habitat} · {species.region}</p><p>{species.size}</p><div className="notice">Ficha introdutória. O catálogo deverá passar por revisão especializada antes do uso científico. Não manipule abelhas para identificá-las.</div><button className="button" onClick={() => { setSpecies(null); setCreating(true); }}>Registrar um encontro</button></Modal>}
    {selectedObservation && <ObservationDetail observation={selectedObservation} nickname={nickname} setNickname={setNickname} onClose={() => setSelected(null)} onUpdate={update} />}
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div></IonApp>;
}
createRoot(document.getElementById('root')).render(<App />);
