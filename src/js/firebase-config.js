const firebaseConfig = {
    apiKey: "AIzaSyAFiDHRY_DuJ6pLzDmR-M2bNhzgxsX9doE",
    authDomain: "projetopastel-24h.firebaseapp.com",
    projectId: "projetopastel-24h",
    storageBucket: "projetopastel-24h.firebasestorage.app",
    messagingSenderId: "348495095024",
    appId: "1:348495095024:web:b3e49b8ef1909e4e7ece35",
    measurementId: "G-0D4BNK64Z7"
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Habilitar persistência offline (opcional, mas bom para PWA feel)
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Múltiplas abas abertas, persistência offline pode não funcionar como esperado.");
    } else if (err.code == 'unimplemented') {
      console.warn("O navegador atual não suporta persistência offline.");
    }
  });
