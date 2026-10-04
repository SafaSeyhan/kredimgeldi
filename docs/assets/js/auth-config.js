// KredimGeldi üyelik sistemi ayarları.
// Supabase projesi oluşturduktan sonra (Project Settings > API) bu iki değeri doldurun.
// "anon public" anahtarı tarayıcıda kullanılmak için tasarlanmıştır, burada durması güvenlidir.
// "service_role" anahtarını ASLA buraya yazmayın.
window.KG_AUTH_CONFIG = {
    supabaseUrl: '',      // örn. 'https://abcdefgh.supabase.co'
    supabaseAnonKey: ''   // örn. 'eyJhbGciOi...'
};
