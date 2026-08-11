# Phát hiện về nền tảng

Những thứ đo được về **MindPal** trong lúc chạy eval — tách khỏi bảng điểm của agent.

---

## 1. Docs đi sau sản phẩm — 5 trường hợp độc lập

| # | Docs nói | Sản phẩm thực tế |
|---|---|---|
| 1 | Kiểu Human Input gồm `BOOLEAN`, `NUMBER` | **Không tồn tại cả hai.** Chỉ có `TEXT · SELECT · MULTI SELECT · DOCUMENT · IMAGE · URL · AUDIO VIDEO` — và `AUDIO VIDEO` thì docs không nhắc |
| 2 | Danh sách model Google: 3.0 Pro, 2.5 Pro, 2.5 Flash | **`Gemini 3.0 Flash` chọn được** trong sản phẩm, không có trong danh sách docs *(nhưng có trong bảng giá)* |
| 3 | Không hề mô tả toggle **Model: Auto** | Tồn tại, có mô tả riêng *"dynamically select the best available model"*, giá riêng **5 credit/request** |
| 4 | Gemini 3.0 Flash = **1** credit/request | Đo được **2.00**, phương sai 0 qua 18 run |
| 5 | API docs tại `api-v3.mindpal.io/docs` | Endpoint thật: `api.mindpal.io/api/**v2**/workflow/run` |

Năm trường hợp, năm khu vực khác nhau của sản phẩm (input types, model list, model settings, pricing, API). Không phải sơ suất lẻ — **tài liệu tụt lại sau sản phẩm một cách hệ thống**.

Hệ quả với eval: **không được lấy docs làm ground truth cho hành vi sản phẩm.** Mọi con số phải đo. Đây là bài học phương pháp lớn nhất của buổi chạy — và cũng là cái bẫy tôi đã sập vào khi tin docs mà kết luận "Auto = GPT-4o Mini".

---

## 2. Tự động hoá bị khoá toàn bộ ở Free plan

| Cơ chế | Trạng thái | Cách phát hiện |
|---|---|---|
| Bulk Run | 🔒 | Upload CSV OK → preview 6 dòng hợp lệ → modal *"Upgrade to enable bulk run"* chặn ở **bước cuối** |
| Public API | 🔒 | Tab `API Reference` hiện đầy đủ endpoint + header `x-api-key`, nhưng không tạo được key |
| Schedule Trigger | 🔒 | Docs |

Mẫu chung: **tính năng hiển thị đầy đủ trong UI free, chặn đúng ở bước cuối cùng.**

⇒ Trên Free plan, cách duy nhất để đo agent là **chạy tay từng run**. Điều này giải thích một phần vì sao *"agent của tôi chạy ổn"* vẫn là mức bằng chứng phổ biến nhất: nền tảng không cấp công cụ nào để làm tốt hơn.

---

## 3b. Đơn vị tính tiền: **2.00 credit mỗi lần gọi LLM**

Đo ở hai cấu hình độc lập, cùng model `Gemini 3.0 Flash`:

| Cấu hình | Node LLM chạy | KB? | Credit |
|---|---|---|---|
| SUT-A · `Human Input → Agent` | 1 | ✅ có | **2.00** |
| SUT-B · `Human Input → Gate` *(dừng tại Gate)* | 1 | ❌ không | **2.00** |

⇒ Bảng giá docs ghi Gemini 3.0 Flash = **1 credit/request**. Giá thật là **2.00** — **gấp đôi**.

Giới hạn của kết luận: mới đo **một** model. Chỉ được nói *"model duy nhất đo được có giá thật gấp đôi niêm yết"*, **không** được suy ra toàn bộ bảng giá đã nhân đôi.

### Mỗi node LLM là một giao dịch riêng

W1 chạy đủ (`Human Input → Gate → Router → Agent`) sinh ra **3 giao dịch tách biệt** trong sổ cái:

| Giờ | Node | Credit |
|---|---|---|
| 17:21:06 | Gate *(Flash ghim)* | 2.00 |
| 17:21:29 | **Router** | **1.00** |
| 17:21:43 | Agent ENTERPRISE *(Flash ghim)* | 2.00 |
| | **Tổng** | **5.00** |

*(Dự đoán trước khi chạy là 6.00 — sai, vì Router chỉ tốn một nửa.)*

### Bảng giá đo được

| Thành phần | Credit |
|---|---|
| Human Input | **0** |
| Agent node · Gemini 3.0 Flash ghim | **2.00** |
| Gate node · Gemini 3.0 Flash ghim | **2.00** |
| **Router node** · model do MindPal chọn | **1.00** |
| Agent node · **Auto mode** | **5.00** |

Giải thích được toàn bộ số liệu buổi đo: SUT-A `2.00` · run dừng tại Gate `2.00` · W1 đủ `5.00` · A-auto `5.00`.

### Router: chỗ thứ hai MindPal chọn model thay bạn

Panel Router **không có ô chọn agent** — chỉ có `Routing logic` và danh sách `Path`. Không có cách nào ghim model cho nó.

Giá 1.00 khác hẳn 2.00 của Gate và Agent *(cùng workflow, cùng lúc, model ghim `Gemini 3.0 Flash`)* là bằng chứng: **Router chạy trên một model khác, do MindPal chọn, không hiển thị ở đâu.**

| Nơi MindPal tự chọn model | Có tiết lộ không? |
|---|---|
| **Auto mode** | ❌ badge run để trống |
| **Router node** | ❌ không có ô chọn, không hiển thị |

Hệ quả: người dùng ghim model cho agent và tin rằng cả workflow chạy trên model đó. Thực tế **mỗi node Router lặng lẽ chạy trên thứ khác** — với đặc tính, chất lượng và độ trễ không ai biết.

---

## 3. Tính tiền phẳng theo lượt gọi, không theo token

| Arm | Credit/run | Số run | Phương sai |
|---|---|---|---|
| `A-pin` · Gemini 3.0 Flash | **2.00** | 18 | **0** |
| `A-auto` · Auto mode | **5.00** | 18 | **0** |

Bất biến dù độ dài output chênh nhau đáng kể, và dù một run *(A4 lượt 1)* không hề kích hoạt RAG.

**Hệ quả thật cho người dùng:**
- Câu trả lời 20 chữ và 2.000 chữ **giá y hệt nhau**
- Prompt dài thêm không tốn thêm
- Tối ưu prompt cho ngắn gọn **không tiết kiệm được gì** — chỉ đổi model mới đổi được chi phí

---

## 4. Auto mode: trả gấp 2,5× để mất quyền quan sát

| | `A-pin` | `A-auto` |
|---|---|---|
| Badge trong bản ghi run | `… · Gemini 3.0 Flash` | `…` — **không có tên model** |
| Credit/run | 2.00 | **5.00** |
| Chất lượng | 4.67 | 4.78 *(chênh lệch = nhiễu)* |

Auto tự mô tả là *"dynamically select the best available model at the moment"* — tức model **có thể đổi giữa các lần chạy**. Và đó cũng chính là chế độ MindPal **không tiết lộ** model nào vừa chạy.

> Không thể phát hiện thứ không được phép quan sát.

Kênh quan sát gián tiếp duy nhất còn lại: **hoá đơn**. 2.00 là một lớp model, 5.00 là lớp khác.

---

## 5. Quan sát chi phí — phần lớn chính xác

Sau khi loại hết những claim không đứng vững, chỉ còn **hai** mục có vấn đề:

| Nơi | Vấn đề | Mức |
|---|---|---|
| Thẻ `Total Credits Used` | Gộp credit **được tặng** vào mục "đã tiêu" *(−200 referral + 2 tiêu = −198)* | Nhãn gây hiểu nhầm, toán tự nhất quán |
| Bulk Cost Breakdown | Ước `10 credit/dòng`, thực tế `2.00` | Lệch **5×** |

**Đúng, không phải vấn đề:** chip header workflow · tab Analytics của workflow · bảng `Recent Transactions` · thẻ `Remaining Credits` *(cần tải lại trang; sau refresh hiện đúng 162.00, khớp chính xác sổ cái)*.

---

## 6. Độ trễ

Mean **25,3s**, dải 23–29s, p95 **~29s** *(n=6, `A-pin`)*. Một câu tra cứu một dòng trong tài liệu 1 trang mất **25 giây**.

Không nằm trong bất kỳ dự đoán nào trước khi chạy, và là metric duy nhất chạm ngưỡng cảnh báo.

---

## 7. Chi phí để đo chất lượng

| | |
|---|---|
| Bộ eval | 6 task × 2 arm × 3 lượt = 36 run |
| Chi phí | **138 credit** |
| Ngân sách workspace | 300 *(100 free + 200 referral)* |
| Tỉ lệ | **46%** |

Spec yêu cầu chạy full suite **hằng tháng** cộng canary hằng tuần. Free tier (100 credit/tháng) **không kham nổi một lần chạy duy nhất**.

⇒ Đo chất lượng agent một cách nghiêm túc trên MindPal là **hoạt động phải trả tiền**, và không có gói nào định giá theo hướng đó.
