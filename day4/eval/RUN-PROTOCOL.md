# Run Protocol — bấm gì, ghi gì

Ngân sách: **~115 credit** trên tổng **300** thực có (100 free + 200 tặng). Đệm ~183.
**n = 3.** Tổng **48 run chạy tay**, ~30–40 phút bấm.

> 🔒 **Bulk Run bị khoá trên Free plan** — xác nhận bằng thực nghiệm, không phải phỏng đoán. Public API và Schedule Trigger cũng khoá. **Chỉ chạy tay được.**
> Vì mỗi run phải bấm tay, n giữ ở **3** thay vì 5: 48 lượt là mức người thật chịu được, 80 lượt thì không. Đây là đánh đổi giữa độ chặt thống kê và sức người — và phải ghi rõ trên trang Day 4, không giấu.

---

## Bước 0 · Trước khi tốn credit đầu tiên

- [ ] Điền **bảng ghi cấu hình** cuối [SUT.md](SUT.md) — đặc biệt là credit còn lại
- [ ] **Kiểm tra Bulk Run có mở trên Free plan không.** Mở workflow `EVAL-A-runner` → tab Run → tìm mục Bulk.
  - Có → theo đường A dưới đây
  - Không → theo **đường B (chạy tay)**. Kết quả vẫn thật, chỉ tốn thêm ~45 phút bấm

> Đây là rủi ro số 1 của cả kế hoạch. Kiểm tra nó trước, không phải sau.

---

## Bước 1 · SUT-A, arm **A-pin** *(18 credit)*

1. Agent → Language model → toggle Auto **TẮT** → chọn `Gemini 3.0 Flash`
2. **Chụp màn hình ô model** *(sẽ là bằng chứng trên trang Day 4)*
3. Ghi credit còn lại **trước** khi chạy
4. Bulk Run [bulk-agent.csv](bulk-agent.csv) → chờ xong → ghi credit còn lại **sau**
5. Lặp lại thêm **2 lần nữa** (tổng 3 lượt) — cùng file, không sửa gì

> **Nếu header CSV bị MindPal từ chối:** tải template CSV từ chính màn hình Bulk Run, rồi chép 6 câu hỏi từ [bulk-agent.csv](bulk-agent.csv) vào đúng cột mà template quy định. Nội dung câu hỏi mới là thứ quan trọng, tên cột thì theo MindPal.

**Ghi cho mỗi run:** `resolved_model` (UI hiện gì) · credit trước/sau · thời gian chạy · **toàn bộ transcript**

---

## Bước 2 · SUT-A, arm **A-auto** *(18 credit)*

1. Cùng agent đó → Language model → toggle Auto **BẬT**
2. **Chụp màn hình** — quan trọng: chứng minh chỉ đúng một biến thay đổi
3. **Ghi lại UI hiển thị model nào** khi Auto bật. Docs nói default là GPT-4o Mini; xác nhận bằng mắt
4. Chạy lại đúng [bulk-agent.csv](bulk-agent.csv), 3 lượt

> **Chú ý credit.** Gemini 3.0 Flash = 1 credit/request. GPT-4o Mini **không có trong bảng giá công khai** của MindPal. Nếu credit/run ở arm này khác arm trước, đó là dữ liệu mới chưa ai công bố — ghi lại chính xác.

---

## Bước 3 · SUT-B, workflow *(27 credit)*

1. Bulk Run [bulk-workflow.csv](bulk-workflow.csv) — 3 dòng
2. Lặp 3 lượt
3. Với **mỗi** run ghi: dừng ở Gate hay chạy hết · dòng `SEGMENT:` đầu ra · credit · thời gian

**Quan sát thêm — mở Run History và tìm:**
- Có node nào nhận vào một object thô kiểu `{"text":...,"documents":[]}` thay vì chuỗi sạch không? *(lỗi stringification bạn đã bắt ở Day 3 — kiểm xem nó có tái hiện)*
- W3 có ra **cùng một nhánh cả 3 lần** không?

---

## Bước 4 · SUT-C, Mindie *(~6 credit)*

1. Tạo workflow trống mới
2. Mở Mindie ở chế độ **Ask to Edit**, dán prompt trong [SUT.md](SUT.md)
3. **Không bấm chạy.** Chụp/export JSON workflow sinh ra
4. Lặp 3 lần, mỗi lần workflow trống mới

Tự kiểm 5 mục C1–C5 trong [tasks.md](tasks.md), hoặc gửi tôi JSON để tôi lint.

---

## Bước 5 · Bàn giao cho tôi

Gửi lại:

1. **Transcript đầy đủ** — 36 run của SUT-A (6 task × 3 lượt × 2 arm), 9 run của SUT-B
2. **[results/run-log-template.csv](results/run-log-template.csv) đã điền** — ít nhất các cột: `task_id, arm, repeat, resolved_model, credits_used, latency_s`
3. **JSON workflow từ Mindie** — 3 bản
4. **Ảnh chụp** — 2 ô cấu hình model, 1 màn hình Run History, bất kỳ lỗi lạ nào bắt gặp

Tôi lo phần: chạy T0 rule check · chấm T1 mù · tính κ · dựng scorecard · viết `day4/index.html`.

---

## Cột `notes` — ghi cả những thứ "không thuộc kế hoạch"

Task suite chỉ bắt được lỗi mà nó được thiết kế để bắt. Phát hiện đắt giá nhất thường nằm ngoài bảng.

Đáng ghi: run nào chậm bất thường · UI hiện model khác dự kiến · credit trừ không khớp · workflow treo · thông báo lỗi lạ · output đúng nhưng "sai sai".

---

## Nếu credit sắp cạn

Cắt theo thứ tự này, dừng lại ngay khi đủ:

| Ưu tiên | Phần | Lý do |
|---|---|---|
| Giữ bằng mọi giá | A-pin + A-auto, n=3 | Đây là phát hiện trung tâm: cái giá của việc để mặc định |
| Giữ | W3, n=3 | Phép đo path consistency duy nhất |
| Cắt được | W1, W2 xuống n=2 | Kết quả nhị phân, ít biến động |
| Cắt được | M1 xuống n=1 | Lint tĩnh, 1 mẫu vẫn cho thấy lớp lỗi |
| Cắt cuối cùng | Bỏ hẳn SUT-C | Vẫn còn 2 SUT và 9 task — trên mức tối thiểu 5–10 của đề bài |
