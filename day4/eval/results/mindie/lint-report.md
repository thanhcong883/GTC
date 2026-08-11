# SUT-C · Mindie build-time lint — 3 lượt

Cùng **một** prompt, chạy 3 lần trong 3 workflow trống:

```
Build a workflow that collects a company name and industry from the user,
loops over the top 5 competitors, researches each one, and emails a summary.
```

Chế độ **Ask to Edit**. Không chạy workflow — chỉ lint tĩnh JSON sinh ra.

---

## Bảng lint

| Phép kiểm | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| **C1** · đúng một starting point | ✅ | ✅ | ✅ |
| **C2** · không có node rời | ✅ | ✅ | ✅ |
| **C3** · mọi ref trỏ field có thật, nằm trước | ✅ | ✅ | ✅ |
| **C4** · Loop có `maxItems` tường minh | ❌ | ❌ | ❌ |
| **C5** · có node gửi email/webhook | ⚠️ | ⚠️ | ⚠️ |

**12/15 pass.** Cấu trúc đồ thị hoàn hảo 3/3. Nhưng hai cột cuối đều hỏng theo cùng một kiểu, ở cả ba lượt.

---

## 🔴 Phát hiện chính: **3 lượt, 3 cú pháp tham chiếu loop khác nhau**

Cùng một khái niệm — "phần tử hiện tại của vòng lặp" — Mindie sinh ra ba dạng khác nhau:

| Run | Cú pháp trong `LoopNode.prompt` | `listItemName` |
|---|---|---|
| **1** | `@[competitor](type=**VARIABLE**)` | `competitor` |
| **2** | `@[competitor](type=**LOOP_ITEM**&loopNodeId=node-3)` | `competitor` |
| **3** | `@[competitor_name](type=**WORKFLOW_NODE_LOOP_ITEM**&listItemName=competitor_name)` | `competitor_name` |

Ba giá trị `type=` khác nhau: `VARIABLE` · `LOOP_ITEM` · `WORKFLOW_NODE_LOOP_ITEM`.

Ba giá trị `type=` khác nhau cho cùng một khái niệm là bất thường, và **chưa giải thích được**.

### ❌ Giả thuyết "hai trong ba không bind" — ĐÃ BỊ BÁC BỎ

Quan sát ban đầu: trong builder, `@[competitor_name](type=WORKFLOW_NODE_LOOP_ITEM&…)` render thành **chữ thường**, trong khi `Company Name` và `Identify Top Competitors` render thành **chip màu**. Suy ra: tham chiếu không bind, agent vòng lặp sẽ nhận nguyên chuỗi.

**Chạy thật thì ngược lại.** Run 3 với input `Notion / productivity software` cho ra 5 phân tích đầy đủ về **Coda, Microsoft Loop, ClickUp, Obsidian, Confluence** — đối thủ thật, giá cả gần đúng thực tế. Tham chiếu **bind hoàn hảo**.

> Suy từ **cách builder hiển thị** sang **hành vi runtime** là sai — cùng lớp lỗi với suy từ docs sang hành vi sản phẩm. Chip không hiện **không** đồng nghĩa với không bind.

### Kết luận đúng, hẹp hơn: lỗi nằm ở đường gõ tay

| Dạng tham chiếu | Nguồn | Kết quả |
|---|---|---|
| `@monthly_budget_usd` — **tên trần**, gõ tay | SUT-B | ❌ **Không bind** — Gate nhận nguyên chuỗi, không cảnh báo |
| `@[Nhãn](type=…&id=…)` — **có cấu trúc**, Mindie sinh | SUT-C | ✅ **Bind đúng** |

Parser chấp nhận dạng có cấu trúc, kể cả khi `type=` khác nhau giữa các lượt. Dạng tên trần thì không.

⇒ **Lỗi tham chiếu hỏng nằm ở đường gõ tay của con người, không phải ở Mindie** — ngược với hướng mà H14 của Day 3 gợi ý.

Về ba cú pháp: chỉ được nói **1 trong 3 đã kiểm chứng chạy được** (run 3). Run 1 (`VARIABLE`) và run 2 (`LOOP_ITEM`) **chưa test**.

### Điểm cộng: H5 của Day 3 không xảy ra

Day 3 H5 lo rằng *"Loop parse văn xuôi thành list là điểm dễ vỡ"*. Thực tế: node-2 sinh **đúng 5 tên**, loop chạy **đúng 5 lần**, không lệch. Prompt phòng thủ *("one name per line, no numbering")* làm được việc của nó.

Chất lượng output cũng cao: giá Coda (~$10/$30 per Maker), ClickUp (~$7–10 / $12–19), Obsidian ($50/user/năm thương mại), Confluence (~$6.05/~$11.50) đều sát thực tế. Không bịa loạn.

---

## 🟡 C4 hỏng 3/3: Loop không bao giờ được đặt giới hạn

Không lượt nào đặt `maxItems`. Cả ba đều dựa vào:
1. Agent phía trước trả về **đúng** 5 dòng
2. Mặc định ẩn của MindPal *(docs: 10 item)*

Không có ràng buộc cấu trúc nào. Nếu node-2 trả về 12 tên, hành vi phụ thuộc một con số không hiện ở đâu trong workflow.

Đây là **H5 của Day 3** *("Loop is a map/foreach over a prior node's output; parsing prose into items is a fragility point")* — và cả ba lượt đều chống đỡ bằng **prompt** chứ không bằng **cấu trúc**:

> *"Provide only a clean, simple, line-separated list ... with no numbering, bullet points, or extra conversational text."*

Ba lượt đều viết câu phòng thủ này, mỗi lượt một cách. Nghĩa là Mindie **biết** đây là chỗ dễ vỡ — nhưng công cụ nó có để xử lý chỉ là năn nỉ model phía trước.

Củng cố thêm: **`outputFormat: null` ở toàn bộ agent, cả 3 lượt.** Không có structured output ở bất cứ đâu.

---

## 🟡 C5: "email" luôn là một agent viết chữ, không phải node gửi thư

| Run | Node cuối | Thực chất |
|---|---|---|
| 1 | *(không có)* | node-4 soạn nội dung email |
| 2 | `Email Distribution` — type **AGENT** | sinh "dispatch-ready transaction metadata payload" |
| 3 | `Format Email Delivery` — type **AGENT** | sinh khối `TO: / SUBJECT: / BODY:` |

Không lượt nào tạo Webhook Node hay tích hợp gửi thư thật. Cả hai lượt sau đều tạo một **agent giả vờ là hệ thống gửi mail** — nó viết ra *văn bản trông giống* một payload email, chứ không gửi gì.

Phần nào hợp lý vì câu trả lời clarify là "no integration" / "placeholder". Nhưng đáng chú ý: thay vì nói *"chưa có tích hợp, hãy thêm sau"*, Mindie dựng một node **trông như đã xong việc**.

---

## Nhiễu trong phép đo: câu clarify không giống nhau giữa các lượt

Mindie hỏi lại trước khi sinh — hành vi tốt. Nhưng câu hỏi và **các lựa chọn đưa ra khác nhau** giữa các lượt:

| Run | Câu hỏi | Lựa chọn đã chọn |
|---|---|---|
| 1 | *"Which email tool or integration…"* | `MindPal Internal (No integration)` |
| 2 | *"Which email service or tool…"* | `Use a placeholder / decide later` |
| 3 | *"Which email service or integration…"* | — |

Lựa chọn `MindPal Internal` ở lượt 1 và `MindPal Default Email` ở lượt sau **không phải cùng một mục**. Không thể trả lời y hệt nhau khi menu không giống nhau.

⇒ **Phải ghi rõ giới hạn này:** khác biệt về *số node* (4 vs 5) và *số field* (2 vs 3) một phần do câu trả lời clarify khác nhau, **không** thuần tuý do phi tất định của Mindie.

Nhưng khác biệt về **cú pháp tham chiếu loop** thì không liên quan gì tới email — đó là phi tất định thuần tuý, và là kết luận đứng vững nhất của SUT-C.

---

## Phi tất định ở tầng build — lớp mà SUT-A và SUT-B không chạm tới

| Tầng | Đo được |
|---|---|
| Runtime · agent | Câu chữ khác nhau, **hành vi giống nhau** (36 run) |
| Runtime · workflow | Nhánh **ổn định** (9 run) |
| **Build · Mindie** | **Cấu trúc khác nhau ở mọi lượt** (3 run) |

Đảo ngược trực giác thông thường: phần *chạy* thì ổn định, phần *xây* thì không.

> Thứ bạn tưởng "xây một lần rồi dùng mãi" thật ra là thứ **được rút thăm mỗi lần dựng** — và không có công cụ nào trong sản phẩm cho bạn biết bản rút được có bind đúng hay không.

---

## Điểm cộng cho Mindie, nói cho công bằng

- **Cấu trúc đồ thị hoàn hảo 3/3** — một starting point, không node rời, không tham chiếu ngược
- **Mọi ID field và node đều khớp 3/3** — bug `f-stack` vs `f-tech-stack` của Day 3 **không tái hiện**
- **Hỏi lại trước khi giả định** thay vì tự chọn tích hợp email
- **Chất lượng prompt cao thật** — persona cụ thể, `<response_framework>` có cấu trúc, guideline chống sáo rỗng
- Định dạng ref `@[Nhãn](type=X&id=Y)` là thiết kế **hai lớp** tốt: nhãn cho người đọc, ID cho máy bind

*(Xác nhận lại H18 của Day 3: cả 3 lượt đều dùng system prompt kiểu XML `<background_information>`, `<instructions>`, `<response_framework>`, `<guidelines>` — house style, không phải bằng chứng về backend.)*

---

## Phép thử tiếp theo, nếu còn ngân sách

Chạy thật cả ba workflow với cùng input, xem agent trong vòng lặp nhận được **tên đối thủ** hay nhận được **chuỗi `@[competitor](type=VARIABLE)`**.

Đó là cách duy nhất biết cú pháp nào bind thật. Chi phí ước tính mỗi workflow: node-2 + 5 vòng lặp + node-4 (+ node-5) ≈ **8 lần gọi ≈ 16 credit**.
