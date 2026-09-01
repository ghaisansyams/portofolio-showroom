# DIECAST SHOWROOM

Portofolio yang dikendarai. 31 proyek berdiri sebagai papan di halaman 3D —
berkendaralah di antaranya, berhenti di depan salah satunya, dan baca detailnya.
Sembilan karya unggulan punya 5–7 screenshot berlabel yang bisa ditelusuri;
papannya sendiri berganti-ganti foto selama kamu berhenti di depannya.

Datanya bukan salinan manual: ditarik langsung dari
[ghaisansyams.vercel.app](https://ghaisansyams.vercel.app).

Static site murni — tanpa build step, tanpa `npm install`.

![Diecast Showroom](preview.png)

## Main

**[diecast-showroom.vercel.app](https://diecast-showroom.vercel.app)**

| Tombol | Fungsi |
| --- | --- |
| `W` `A` `S` `D` | berkendara |
| `E` | buka detail papan terdekat |
| `←` `→` | ganti foto (saat detail terbuka) |
| `Esc` | tutup detail |
| `Space` | rem tangan |
| `R` | balikkan mobil kalau kebalik |

Di HP tombol sentuh muncul otomatis, termasuk tombol **Detail**.

## Tata letak

Dua lingkaran sepusat dengan boulevard di antaranya:

```
        lingkar luar r=70  —  22 eksperimen, menghadap ke DALAM
   ┌──────────────────────────────────────────┐
   │   boulevard r=34..70  ← mobil di sini    │
   │   ┌──────────────────────────────────┐   │
   │   │  lingkar dalam r=34  —  9 karya  │   │
   │   │  unggulan, menghadap ke LUAR     │   │
   │   │        ▲ plaza + monumen         │   │
```

Karena kedua lingkaran menghadap ke boulevard, berkendara memutar berarti karya
unggulan di satu sisi dan eksperimen di sisi lain. Papan lingkar luar diurutkan
per kategori (3D & Creative → Games → Web) dengan rambu gerbang di tiap pergantian.

## Galeri foto

Portofolionya menyimpan beberapa screenshot berlabel per karya unggulan —
"Landing", "Dashboard", "AI Matchmaking", dan seterusnya. Totalnya 80 foto:
58 tersebar di 9 karya unggulan, 22 sisanya satu-satu untuk tiap eksperimen.

Semua ikut ditarik. Di panel detail ada galeri lengkap: foto besar, label,
penghitung, panah kiri/kanan, dan deretan thumbnail. Di dunia 3D, papan yang
sedang kamu hadapi berganti foto sendiri dengan crossfade tiap 2.8 detik.

Sinkronisasi menormalkan keduanya jadi satu bentuk — tiap proyek punya array
`shots` berisi `{src, label, blur}`, dan eksperimen yang cuma punya satu gambar
tetap dapat array berisi satu elemen. Penampilnya jadi tidak perlu percabangan.

## Sinkronisasi data

```bash
node scripts/sync-portfolio.mjs        # tulis ulang portfolio-data.js
PORTFOLIO_ORIGIN=http://localhost:5173 node scripts/sync-portfolio.mjs
```

Portofolionya SPA Vite tanpa JSON API, jadi datanya dibaca dari bundle yang
ter-deploy. Yang perlu diingat:

**Array dicari lewat tanda tangan isi, bukan nama variabel.** Minifier mengganti
nama tiap build (`fr`, `Af`, `PS` hari ini, entah apa besok), tapi kunci object
literal tidak ikut diganti. Jadi array flagship dikenali karena entrinya punya
`subtitle:`/`year:`/`role:`, dan array more-work karena punya `category:` —
kunci-kunci itu sudah dicek muncul di satu array saja dan tidak pernah di keduanya.

**Kandidat di-bracket-match dulu, baru marker diuji.** Versi pertama menguji
marker pada jendela lebar tetap dari posisi `[{id:"`, dan jendela itu meluber
melewati akhir array kategori yang cuma 4 entri ke array proyek di sebelahnya —
hasilnya array kategori lolos sebagai daftar proyek. Sekarang batas array
ditentukan lebih dulu, marker diuji di dalamnya, lalu tiap entri divalidasi
punya `id` dan `name`.

**Gambar tidak disalin.** Portofolio menyajikannya dengan
`access-control-allow-origin: *`, jadi papan mengambil tekstur langsung dari
sana dan screenshot ikut terbarui tanpa menjalankan ulang script ini. Yang
di-bake cuma teks. Gambar dikecilkan ke lebar 512 px saat masuk — 31 screenshot
ukuran penuh memakan sekitar 150 MB memori GPU.

## Stack

- **three.js r128** dan **cannon.js 0.6.2** dari cdnjs, keduanya build UMD
- `RaycastVehicle` yang sama dengan [Diecast Rally](https://github.com/ghaisansyams/diecast-rally)
- Satu `index.html` + `portfolio-data.js` hasil generate. Tanpa framework.

## Catatan teknis

**Titik spawn dihitung, bukan ditebak.** Titik baca tiap papan ada 7.5 m di
depannya, dan radius fokus 13 m. Di boulevard, jarak ke titik baca lingkar dalam
dan lingkar luar nyaris sama, jadi hampir semua posisi awal membuat mobil sudah
"membaca" papan sebelum pemain bergerak. Sudut 140° pada r=47.5 dicari secara
numerik terhadap seluruh 31 titik baca: jarak terdekatnya 16.5 m.

**Perpindahan fokus pakai histeresis.** Garis tengah boulevard berjarak sama ke
kedua lingkaran, jadi aturan "yang terdekat menang" membuat fokus berkedip antar
papan tiap frame. Penantang baru harus setidaknya 28% lebih dekat untuk merebut.

**Galeri dibatasi dua proyek di memori GPU.** 80 screenshot yang semuanya
resident memakan sekitar 70 MB. Jadi saat start hanya foto sampul tiap proyek
yang dimuat (31 tekstur); sisanya menyusul hanya untuk papan yang sedang
difokus, dan cuma dua proyek terakhir yang galerinya disimpan — selebihnya
dilepas kembali ke foto sampul. Ada jeda 1.2 detik sebelum pemuatan dimulai,
supaya sekadar melintas tidak memicu unduhan.

**Lapisan crossfade disembunyikan saat menganggur.** Papan punya dua plane:
satu untuk foto sekarang, satu untuk foto berikutnya yang memudar di atasnya.
Material `transparent` tetap dirender three.js walaupun `opacity` 0, jadi 31
lapisan itu sempat menambah overdraw percuma sebelum `visible = false`.

**Bingkai galeri 16:10, bukan 16:8 dengan `cover`.** Sumbernya 1600×1000
hampir seragam. Versi awal memakai bingkai lebih pendek dengan `object-fit:
cover`, yang memotong bagian bawah tiap screenshot — hal terakhir yang pantas
dilakukan portofolio pada karyanya sendiri.

**Nameplate digambar ulang setelah webfont mendarat.** Teks canvas diukur dengan
font yang siap saat itu juga, jadi tanpa `document.fonts.ready` semua nameplate
akan ter-render dengan font fallback.
