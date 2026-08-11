# SUT-B · Lead Qualification Workflow — Scorecard

**9/9 run** · n=3 mỗi task · `Gemini 3.0 Flash` ghim cho Gate và 2 Agent node · 2026-07-21

```
Human Input → Gate → Router ─┬→ Agent SMB
                             └→ Agent ENTERPRISE
```

---

## Bảng điểm

| Task | Input | Đường đi đúng | Kết quả 3 lượt | pass^3 |
|---|---|---|---|---|
| **W1** | `Nordwind Logistics · 40 · 500` | Gate ✓ → PATH 2 → Agent ENT | 3/3 đúng | ✅ |
| **W2** | `Solo Freelance Studio · 1 · 0` | **Gate STOP** | 3/3 đúng | ✅ |
| **W3** 🔒 | `Meridian Systems · 20 · 50` | Gate ✓ → PATH 2 → Agent ENT | 3/3 đúng | ✅ |

| Metric | Kết quả |
|---|---|
| TSR | **9/9 = 100%** |
| **Path consistency** | **100%** — mỗi task đi cùng một nhánh cả 3 lượt |
| Biến resolve đúng | 9/9 sau khi sửa |
| Format `SEGMENT:` | ⚠️ khớp tiền tố, không khớp dòng — *xem mục Lỗi spec* |
| Credit | W1/W3 **5.00** · W2 **2.00** |

**Wilson 95% CI:** 9/9 → **[70,1% – 100%]** · riêng W3 3/3 → **[43,9% – 100%]**

---

## Kết quả chính: so sánh số trên chuỗi **không** bất ổn ở n=3

Docs MindPal không có kiểu field `NUMBER` *(dù docs nói có)*, nên `team_size` và `monthly_budget_usd` buộc phải là `TEXT`. Gate và Router phải so sánh số **trên chuỗi**, bằng LLM, không có ép kiểu.

Giả thuyết trước khi chạy: ranh giới sẽ lung lay, đặc biệt ở W3 nơi cả hai điều kiện đúng *bằng* ngưỡng.

**Giả thuyết sai.** Cả ba task ổn định 3/3. Reasoning của W3 chính xác về mặt logic:

> *"The supplied team_size is 20. According to the routing logic, the ENTERPRISE path is selected if team_size is 20 or greater. Since 20 satisfies the condition 'team_size >= 20', Path 2 is the correct choice."*

Gate W2 cũng trích đúng cả hai giá trị: *"Both criteria are unmet: monthly_budget_usd is 0 and team_size is 1."*

### Nhưng 3/3 gần như không chứng minh được gì

| Mẫu | Wilson 95% CI |
|---|---|
| **W3 riêng: 3/3** | **[43,9% – 100%]** |
| SUT-B gộp: 9/9 | [70,1% – 100%] |
| SUT-A gộp: 36/36 | [90,4% – 100%] |

Tỉ lệ ổn định thật của W3 có thể chỉ **45%** mà ta vẫn dễ dàng quan sát được 3/3.

> **Nghịch lý của bộ eval nhỏ:** những task ta *muốn kiểm nhất* — ranh giới, hiếm gặp, đối kháng — chính là những task mà n=3 cho **ít thông tin nhất**.
> Muốn phát hiện tỉ lệ lật nhánh 10% với độ tin cậy tử tế cần ~**30 lượt riêng cho W3** ≈ 150 credit cho một task duy nhất.
> Ngân sách quyết định độ mạnh của kết luận. Đây là ràng buộc thật của việc đo agent, không phải chi tiết phụ.

---

## Lỗi tham chiếu biến: chạy im lặng, không cảnh báo

Lần dựng đầu, biến trong Gate được **gõ tay** thay vì chọn từ dropdown `@`. Kết quả:

> *"The values for monthly_budget_usd and team_size were provided as **unresolved placeholders** (@monthly_budget_usd and @team_size) instead of specific numbers. Because I cannot verify if the criteria are met, the workflow must stop."*

Input `40` và `500` có đủ trên màn hình. Nhưng MindPal đưa **nguyên chuỗi** `@monthly_budget_usd` vào prompt.

**Không có bất kỳ cảnh báo nào** — không lỗi lúc lưu, không lỗi lúc chạy. Workflow chạy bình thường, trạng thái `Completed`/`Stopped`, và trả về quyết định nghe rất thuyết phục.

Đây là bản tái hiện **H14 của Day 3** *("no build-time validation — Mindie can emit broken references that pass review unchecked")*, nhưng với workflow **do người viết tay** — nên lớp lỗi rộng hơn H14 mô tả.

**Vì sao nguy hiểm:** Gate hỏng theo hướng an toàn (STOP) nhưng hỏng **âm thầm**. Chạy 100 lead qua workflow này, bạn thấy 100 lead bị loại và kết luận "điều kiện lọc quá chặt" — không nghĩ dữ liệu chưa bao giờ tới. Lời giải thích có nằm trong ô `Reasoning`, nhưng chỉ ai mở từng run ra đọc mới thấy.

**Và chỉ Gate mới lộ.** Gate buộc phải so sánh số nên không làm được thì nói ra. Agent node nhận `@company_name` dạng chữ vẫn sẽ viết một email hoàn chỉnh, đẹp đẽ — gửi cho công ty tên "@company_name". Không lỗi, không cảnh báo, output nhìn vẫn ổn.

> Lớp lỗi này **chỉ ồn ào ở đúng một loại node, còn lại thì im lặng**.

---

## Lỗi spec của người thiết kế eval, không phải của agent

Output thực tế:
```
SEGMENT: ENTERPRISE Given Nordwind Logistics' focus on scaling...
```

Assertion v0.1 là `^SEGMENT: ENTERPRISE$` — neo cả dòng ⇒ **FAIL**.
Nhưng instruction v0.1 chỉ viết *"Start your output with the exact line ... and **nothing before it**"* — chỉ ràng buộc phía trước, không yêu cầu xuống dòng phía sau. **Agent làm đúng y nguyên văn.**

⇒ Assertion chặt hơn instruction. Lỗi của bộ eval.

**Xử lý:** không sửa SUT giữa phép đo *(đổi hệ đang đo thì các lượt không còn so sánh được)*. Nới assertion về khớp tiền tố `^SEGMENT: ENTERPRISE\b`, ghi nhận, siết instruction ở **v0.2** kèm chạy lại baseline.

Ghép với bài học từ A6 *(36 run khác câu chữ nhưng cùng hành vi)*:

| Bài học | Nguồn |
|---|---|
| Đừng so khớp văn bản — chấm **hành vi** | SUT-A · A6 |
| Assertion phải khớp **đúng** instruction, không chặt hơn | SUT-B · SEGMENT |

Cả hai dẫn tới một kết luận: **một phần đáng kể "lỗi" mà bộ eval báo cáo là lỗi của chính bộ eval.** Đó là lý do tầng T2 (người chấm) và T3 (κ) tồn tại — không có chúng thì không phân biệt được lỗi hệ với lỗi thước đo.

---

## Chi phí: mô hình dự đoán đúng cả hai chiều

| | Dự đoán | Thực tế |
|---|---|---|
| Giao dịch mới | 22 | **22** *(43 → 65)* |
| Credit | 38.00 | **38.00** |

Phân rã: run hỏng `2.00` + W1×3 @ `5.00` + W2×3 @ `2.00` + W3×3 @ `5.00` = **38.00**

| Node | Credit | Model |
|---|---|---|
| Human Input | 0 | — |
| Gate | 2.00 | Gemini 3.0 Flash *(ghim)* |
| **Router** | **1.00** | **MindPal chọn — không có ô cấu hình, không hiển thị** |
| Agent | 2.00 | Gemini 3.0 Flash *(ghim)* |

Router là **chỗ thứ hai** MindPal chọn model thay người dùng mà không tiết lộ *(chỗ thứ nhất: Auto mode)*. Người dùng ghim model cho agent và tin cả workflow chạy trên model đó — thực tế mỗi node Router chạy trên thứ khác, với chất lượng và độ trễ không ai biết.
