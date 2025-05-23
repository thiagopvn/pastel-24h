if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
  console.log("Firebase já inicializado, usando configuração existente");
  window.auth = window.auth || firebase.auth();
  window.db = window.db || firebase.firestore();
} 
// Caso o Firebase não tenha sido inicializado
else if (typeof firebase !== 'undefined') {
  (function() {
    // Verificar se a configuração já existe antes de declarar
    if (typeof window.firebaseConfig === 'undefined') {
      window.firebaseConfig = {
        apiKey: "AIzaSyAFiDHRY_DuJ6pLzDmR-M2bNhzgxsX9doE",
        authDomain: "projetopastel-24h.firebaseapp.com",
        projectId: "projetopastel-24h",
        storageBucket: "projetopastel-24h.firebasestorage.app",
        messagingSenderId: "348495095024",
        appId: "1:348495095024:web:b3e49b8ef1909e4e7ece35",
        measurementId: "G-0D4BNK64Z7"
      };
    }

    try {
      // Inicializa o Firebase
      if (firebase.apps.length === 0) {
        window.app = firebase.initializeApp(window.firebaseConfig);
      } else {
        window.app = firebase.app();
      }
      
      window.auth = firebase.auth();
      window.db = firebase.firestore();

      // Habilitar persistência offline (opcional, mas bom para PWA feel)
      window.db.enablePersistence()
        .catch((err) => {
          if (err.code == 'failed-precondition') {
            console.warn("Múltiplas abas abertas, persistência offline pode não funcionar como esperado.");
          } else if (err.code == 'unimplemented') {
            console.warn("O navegador atual não suporta persistência offline.");
          }
        });
        
      console.log("Firebase inicializado com sucesso");
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
    }
  })();
} else {
  console.error("Firebase não está disponível. Verifique se os scripts foram carregados corretamente.");
}