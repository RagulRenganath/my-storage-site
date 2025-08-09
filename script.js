import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://eogdsmdypdaxvshaociu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2RzbWR5cGRheHZzaGFvY2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDEzOTYsImV4cCI6MjA3MDMxNzM5Nn0.MTd38DP8nAU1_4MqHDnisQvaSKova5N995tla4Vko8s';
const BUCKET = 'asbacademicdocuments';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Login failed: ' + error.message);
    } else {
        document.getElementById('login').classList.add('hidden');
        document.getElementById('file-section').classList.remove('hidden');
        loadFiles();
    }
}

async function uploadFile() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return alert('Please choose a file');

    const { error } = await supabase.storage.from(BUCKET).upload(file.name, file, { upsert: true });

    if (error) {
        alert('Upload failed: ' + error.message);
    } else {
        alert('File uploaded successfully');
        loadFiles();
    }
}

async function loadFiles() {
    const { data, error } = await supabase.storage.from(BUCKET).list();
    if (error) {
        console.error(error);
        return;
    }

    const list = document.getElementById('fileList');
    list.innerHTML = '';

    data.forEach(file => {
        const li = document.createElement('li');
        li.className = "p-3 rounded-lg bg-white/10 flex justify-between items-center hover:bg-white/20 transition";
        li.innerHTML = `<span>${file.name}</span> 
                        <a href="${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file.name}" target="_blank" class="px-3 py-1 rounded bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm shadow hover:scale-105 transform transition">Download</a>`;
        list.appendChild(li);
    });
}

window.login = login;
window.uploadFile = uploadFile;
