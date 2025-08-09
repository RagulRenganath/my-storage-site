// script.js (module)
// Advanced uploader + manager for Supabase Storage with progress, delete, search, sort & animations.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* ---------------------------
  🔑  Replace these if needed
------------------------------*/
const SUPABASE_URL = 'https://eogdsmdypdaxvshaociu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2RzbWR5cGRheHZzaGFvY2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDEzOTYsImV4cCI6MjA3MDMxNzM5Nn0.MTd38DP8nAU1_4MqHDnisQvaSKova5N995tla4Vko8s';
const BUCKET = 'asbacademicdocuments';
/* --------------------------- */

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const loginCard = document.getElementById('loginCard');
const fileManager = document.getElementById('fileManager');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progressInner = document.getElementById('progressInner');
const progressText = document.getElementById('progressText');
const fileListEl = document.getElementById('fileList');
const emptyMsg = document.getElementById('emptyMsg');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const signOutBtn = document.getElementById('signOutBtn');
const demoBtn = document.getElementById('demoBtn');
const dropArea = document.getElementById('dropArea');

let currentFiles = []; // cached metadata
let uploading = false;

/* ---------- Authentication ---------- */
async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return alert('Enter email and password.');

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert('Login failed: ' + error.message);

  afterLogin();
}

// simple demo helper to show UI (does not sign in)
demoBtn.addEventListener('click', () => {
  emailInput.value = '';
  passwordInput.value = '';
  // Attempt anonymous UI show if auth is not strictly required on backend
  afterLogin();
});

async function afterLogin() {
  loginCard.classList.add('hidden');
  fileManager.classList.remove('hidden');
  signOutBtn.classList.remove('hidden');
  loadFiles();
}

signOutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

/* ---------- Upload with progress (XHR to Supabase REST) ---------- */
uploadBtn.addEventListener('click', () => {
  const f = fileInput.files[0];
  if (!f) return alert('Choose a file to upload.');
  uploadFileWithProgress(f);
});

fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (f) progressText.textContent = `${f.name} ready`;
});

/* Drag & Drop */
;['dragenter','dragover'].forEach(ev => {
  dropArea.addEventListener(ev, (e) => {
    e.preventDefault();
    dropArea.classList.add('drop-hover');
  });
});
;['dragleave','drop'].forEach(ev => {
  dropArea.addEventListener(ev, (e) => {
    e.preventDefault();
    // slight delay remove
    setTimeout(()=>dropArea.classList.remove('drop-hover'), 50);
  });
});

dropArea.addEventListener('drop', (e) => {
  const f = (e.dataTransfer.files || [])[0];
  if (!f) return;
  fileInput.files = e.dataTransfer.files;
  uploadFileWithProgress(f);
});

async function uploadFileWithProgress(file) {
  if (uploading) {
    return alert('Another upload in progress — wait a moment.');
  }
  uploading = true;
  progressInner.style.width = '0%';
  progressText.textContent = `Uploading ${file.name}...`;

  try {
    const encodedName = encodeURIComponent(file.name);
    // Supabase Storage REST: PUT /object/:bucket/:name?upsert=true
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodedName}?upsert=true`;

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`);
      xhr.setRequestHeader('apikey', SUPABASE_KEY);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          progressInner.style.width = pct + '%';
          progressText.textContent = `${pct}% — ${file.name}`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          progressInner.style.width = '100%';
          progressText.textContent = `Uploaded ${file.name}`;
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} — ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(file);
    });

    // small delay for UX, then reload
    setTimeout(loadFiles, 450);
  } catch (err) {
    console.error(err);
    alert(err.message || 'Upload error');
  } finally {
    uploading = false;
    setTimeout(()=>{ progressInner.style.width = '0%'; progressText.textContent = 'Idle'; }, 1200);
  }
}

/* ---------- File listing, searching, sorting ---------- */
async function loadFiles() {
  fileListEl.innerHTML = '';
  emptyMsg.style.display = 'none';
  progressText.textContent = 'Loading files...';

  try {
    // list returns metadata: name, id, updated_at, created_at, metadata.size maybe
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, offset: 0 });
    if (error) throw error;

    currentFiles = (data || []).map(f => ({
      name: f.name,
      updated_at: f.updated_at || f.created_at || null,
      size: f.size || (f.metadata && f.metadata.size) || null
    }));

    renderFileList();
  } catch (err) {
    console.error(err);
    alert('Failed to load files: ' + (err.message || err));
    emptyMsg.style.display = 'block';
  } finally {
    progressText.textContent = 'Idle';
  }
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, n = Number(bytes);
  while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}

function renderFileList() {
  const q = (searchInput.value || '').toLowerCase().trim();
  let list = currentFiles.slice();

  // search
  if (q) list = list.filter(f => f.name.toLowerCase().includes(q));

  // sort
  const sortVal = sortSelect.value;
  if (sortVal === 'updated_desc') list.sort((a,b)=> (b.updated_at||'').localeCompare(a.updated_at||''));
  else if (sortVal === 'updated_asc') list.sort((a,b)=> (a.updated_at||'').localeCompare(b.updated_at||''));
  else if (sortVal === 'name_asc') list.sort((a,b)=> a.name.localeCompare(b.name));
  else if (sortVal === 'name_desc') list.sort((a,b)=> b.name.localeCompare(a.name));

  fileListEl.innerHTML = '';
  if (!list.length) {
    emptyMsg.style.display = 'block';
    return;
  } else emptyMsg.style.display = 'none';

  list.forEach(f => {
    const li = document.createElement('li');
    li.className = 'p-3 rounded-lg bg-white/3 flex items-center justify-between gap-3 transition hover:bg-white/6';
    li.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-md bg-white/6 flex items-center justify-center text-sm font-semibold">${iconFromName(f.name)}</div>
          <div class="min-w-0">
            <div class="font-medium truncate">${escapeHtml(f.name)}</div>
            <div class="small text-white/60">${f.updated_at ? new Date(f.updated_at).toLocaleString() : '—'} • ${formatBytes(f.size)}</div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="downloadBtn px-3 py-1 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white small">Download</button>
        <button class="deleteBtn px-3 py-1 rounded-md bg-red-600/90 text-white small">Delete</button>
      </div>
    `;

    // attach actions
    const downloadBtn = li.querySelector('.downloadBtn');
    const deleteBtn = li.querySelector('.deleteBtn');

    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Preparing...';
      try {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.name, 60); // 60s valid
        if (error) throw error;
        if (data && data.signedURL) {
          // trigger download
          const win = window.open(data.signedURL, '_blank');
          if (!win) {
            // fallback: replace location
            window.location.href = data.signedURL;
          }
        } else {
          throw new Error('Failed to generate download link');
        }
      } catch (err) {
        alert('Download error: ' + (err.message || err));
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download';
      }
    });

    deleteBtn.addEventListener('click', async () => {
      const ok = confirm(`Delete "${f.name}"? This cannot be undone.`);
      if (!ok) return;
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting...';
      try {
        const { error } = await supabase.storage.from(BUCKET).remove([f.name]);
        if (error) throw error;
        // remove locally with a little animation
        li.style.transition = 'opacity .25s, transform .25s';
        li.style.opacity = '0';
        li.style.transform = 'translateY(8px)';
        setTimeout(()=> { li.remove(); }, 250);
        // refresh list after small delay to update metadata
        setTimeout(loadFiles, 500);
      } catch (err) {
        alert('Delete failed: ' + (err.message || err));
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
      }
    });

    fileListEl.appendChild(li);
  });
}

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function iconFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['zip','rar','tar','gz','7z'].includes(ext)) return '🗜️';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  return '📁';
}

/* ---------- search & sort events ---------- */
searchInput.addEventListener('input', () => renderFileList());
sortSelect.addEventListener('change', () => renderFileList());

/* ---------- initial load: check session ---------- */
(async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    afterLogin();
  } else {
    // show login card (already visible)
  }
})();

/* ---------- graceful errors & network hints ---------- */
window.addEventListener('offline', () => {
  progressText.textContent = 'Offline — check your network';
});
window.addEventListener('online', () => {
  progressText.textContent = 'Back online';
});

// expose login for inline calls
window.login = login;

