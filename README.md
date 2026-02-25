# discord-ticket-bot

<div align="center">
  <br />
    <img src="https://i.imgur.com/bvxcjXH.png" width="150" alt="Ticket Bot" />
  <br />
  <h1>🎫 Gelişmiş Discord Ticket & Sunucu Yönetim Botu</h1>
  <p>
    Profesyonel, hızlı ve tamamen optimize edilmiş Discord JS v14 destekli bilet ve yönetim botu.
  </p>
</div>

<details>
  <summary>Tablo İçeriği</summary>
  <ol>
    <li><a href="#hakkında">Hakkında</a></li>
    <li><a href="#özellikler">Özellikler</a></li>
    <li><a href="#kurulum">Kurulum ve Başlangıç</a></li>
    <li><a href="#komutlar">Komutlar</a></li>
    <li><a href="#teknolojiler">Teknolojiler</a></li>
  </ol>
</details>

## 🚀 Hakkında

Bu proje, bir Discord sunucusunun teknik destek ekibinin yönetimini kolaylaştırmak, tüm olayları loglamak ve anlık oyun sunucusu durumunu takip etmek için özel olarak geliştirilmiştir. **Discord.js v14** ve en yeni **Node.js** teknolojileri kullanılarak yazılmıştır. 

"Ghost-ticket" (hayalet bilet) koruması, asenkron transcript kapanış algoritması ve 3 dakikada bir otomatik RAM >> Disk önbellekleme (Cache) sistemi gibi gelişmiş mühendislik optimizasyonlarına sahiptir.

## ✨ Özellikler

* **Gelişmiş Bilet Sistemi:** Butonlu onaylama, "Ticketi Devral" butonu ve gelişmiş bilet yönetim arayüzü (Kullanıcı ekle/çıkar/devret).
* **HTML Transcript (Döküm):** Bilet kapatıldığında konuşma geçmişini şık bir web sayfası `(.html)` olarak özel log kanalına ve bileti açan kullanıcının DM kutusuna gönderir.
* **Yetkili Liderlik Tablosu (Toplist):** En çok ticket çözen yetkilileri Günlük, Haftalık ve Tüm Zamanlar periyotlarında `rank` sistemiyle listeler. Kayıtları tutar.
* **Dinamik Profil (Gamedig):** Oyun sunucusuna sorgu atarak (60 saniyede bir Cache'e alır) botun "Oynuyor" kısmında animasyonlu olarak 10 saniyede bir değişen "Aktif Oyuncu (Örn: 30/128)", "Site Adresi" ve "Slogan" yansıtır.
* **Güvenlik Logları:** Banlanan ve atılan (Kick) üyeleri nedenleriyle birlikte özel sunucu log kanallarına tespit edip atar.
* **Genel Log Sistemi:** Sunucuya katılan/ayrılanlar, silinen mesajlar ve ses kanalına giren/çıkan tüm kullanıcı hareketleri farklı kanallarda detaylıca loglanır.
* **Ses Kanalı Entegrasyonu:** Yöneticiler `/ses` komutu ile botu istedikleri bir ses kanalına sokabilirler (Bot odada aktif şekilde 7/24 kalır).
* **Numaratör Yönetimi:** Açılacak biletlerin başlıklarındaki numara sayı dizisi (Örn: `ticket-0100`) panelden yönetilebilir.

## 💻 Kurulum

Projenin kendi bilgisayarınızda veya VDS sunucularında 7/24 çalıştırılması çok kolaydır.

### Gereksinimler
- Node.js (v18.x veya daha üstü)
- Discord Bot Tokeni ve Client ID (Discord Developer Portal'dan alınır)
- Sunucuda `Message Content`, `Server Members` ve `Presence` intentlerinin açık olması.

### Kurulum Adımları

1. Repoyu bilgisayarınıza/VDS'e klonlayın veya indirin.
2. Klasörün içinde bir terminal (`cmd` veya `powershell`) açın.
3. Gerekli kütüphaneleri yüklemek için aşağıdaki komutu girin:
   ```bash
   npm install
   ```
4. Klasör içerisindeki `.env` dosyasını bir metin editörüyle açın ve kendi bilgilerinizi girin:
   ```env
   DISCORD_TOKEN=SizinBotTokeninizBuraya
   DISCORD_CLIENT_ID=SizinBotİdNumaranızBuraya
   ```
5. Botu başlatın!
   ```bash
   npm start
   ```

## 🛠️ Komutlar

Bot tamamen modern `Slash (/)` komut altyapısı üzerine inşa edilmiştir.

### Yönetici Komutları 👑
* `/kurulum`: Destek sistemini kurar ve buton panelini gönderir. *(Zorunlu ayarlar: Panel Kanalı, Yetkili Rolü, Transcript Log Kanalı, Bilet Kategorisi)*
* `/log_kurulum`: Ban ve Kick loglarının gideceği kanalları ayarlar.
* `/genel_log_kurulum`: Mod/Genel log kanallarını ayarlar *(Giriş-Çıkış, Mesaj-Silinme, Ses-Log)*.
* `/numarator`: Bir dahaki açılacak bilet numarasının sayısını belirler.
* `/ses`: Botun katılacağı Discord ses kanalını belirler.
* `/aktif`: Oyun sunucusunun açıldığını IP adresi ile `@everyone` atarak bildirir.
* `/bakim`: Oyun sunucusunun bakıma alındığını `@everyone` atarak bildirir.

### Yetkili (Destek) Komutları 🛡️
* `/toplist`: Yetkililerin en çok bilet çözme sıralamasını gösterir *(Günlük, Haftalık, Tüm Zamanlar)*.
* `/ekle <kullanici>`: Seçilen kullanıcıyı bilete dahil eder.
* `/cikar <kullanici>`: Seçilen kullanıcıyı bilet yetkisinden men eder.
* `/devret <yetkili>`: Mevcut destek biletini başka bir yetkiliye transfer eder.
* `/kapat`: Güvenli bir şekilde HTML transcript oluşturarak bileti sonlandırır ve siler.

## ⚙️ Teknolojiler
* **[Discord.js v14](https://discord.js.org/)** - Güçlü API Sarmalayıcı
* **[Gamedig](https://www.npmjs.com/package/gamedig)** - Sunucu Query/Sorgu Altyapısı
* **[Discord-html-transcripts](https://www.npmjs.com/package/discord-html-transcripts)** - Mükemmel döküm arayüzü arşivi
* **[@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice)** - Pürüzsüz ses kanalı aktivasyonu

<br />
<div align="center">
  <i>Bu proje, optimize edilmiş asenkron kod yapısıyla hiçbir darboğaz yaşamadan binlerce bilet isteğini eşzamanlı olarak yanıtlayabilecek düzeyde tasarlanmıştır. 🚀</i>
</div>
