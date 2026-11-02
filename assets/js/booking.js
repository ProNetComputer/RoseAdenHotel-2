/**
 * Rose Aden 2 Tourist Hotel - Smart WhatsApp Booking Engine
 * محرك الحجز المباشر عبر واتساب لفندق روز عدن 2
 */

(function () {
  'use strict';

  window.handleQuickBook = function (event) {
    if (event) event.preventDefault();

    const roomType = document.getElementById('bkRoomType') ? document.getElementById('bkRoomType').value : 'جناح VIP';
    const checkIn = document.getElementById('bkCheckIn') ? document.getElementById('bkCheckIn').value : '';
    const checkOut = document.getElementById('bkCheckOut') ? document.getElementById('bkCheckOut').value : '';
    const guests = document.getElementById('bkGuests') ? document.getElementById('bkGuests').value : '1';
    const guestName = document.getElementById('bkGuestName') ? document.getElementById('bkGuestName').value.trim() : '';

    let text = "السلام عليكم ورحمة الله وبركاته،\nأود الاستفسار وتأكيد حجز في فندق روز عدن 2 السياحي:\n";
    if (guestName) text += "• الاسم الكريم: " + guestName + "\n";
    text += "• نوع الإقامة المطلوبة: " + roomType + "\n";
    if (checkIn) text += "• تاريخ الوصول: " + checkIn + "\n";
    if (checkOut) text += "• تاريخ المغادرة: " + checkOut + "\n";
    text += "• عدد النزلاء: " + guests + "\n";
    text += "يرجى التكرم بتأكيد التوفر والسعر. شكراً لكم!";

    const encoded = encodeURIComponent(text);
    const waUrl = "https://wa.me/967780000656?text=" + encoded;
    window.open(waUrl, '_blank');
  };

  // Direct room booking button helper
  window.bookSpecificRoom = function (roomName) {
    const text = "السلام عليكم، أود حجز " + roomName + " في فندق روز عدن 2 السياحي. يرجى إفادتي بالتفاصيل والتوفر.";
    const waUrl = "https://wa.me/967780000656?text=" + encodeURIComponent(text);
    window.open(waUrl, '_blank');
  };
})();