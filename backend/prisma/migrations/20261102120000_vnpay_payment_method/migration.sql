-- Thêm cổng thanh toán VNPAY. Chỉ mở rộng enum nên không đổi dòng nào đang có.

ALTER TABLE `orders`
    MODIFY `paymentMethod` ENUM('COD', 'MOMO', 'VNPAY') NOT NULL DEFAULT 'COD';
