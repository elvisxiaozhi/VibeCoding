import SwiftUI

struct AssetFormView: View {
    @Environment(\.dismiss) private var dismiss

    let asset: Asset?
    let onSubmit: (AssetDraft) async -> Bool

    @State private var symbol = ""
    @State private var category: AssetCategory = .stock
    @State private var costBasis = ""
    @State private var currentPrice = ""
    @State private var quantity = ""
    @State private var error: String?
    @State private var isSubmitting = false

    private var isEdit: Bool { asset != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("资产代码/名称", text: $symbol)
                        .autocorrectionDisabled()
                    Picker("分类", selection: $category) {
                        ForEach(AssetCategory.allCases, id: \.self) { cat in
                            Text(cat.label).tag(cat)
                        }
                    }
                }

                Section("价格") {
                    TextField("成本价", text: $costBasis)
                        .keyboardType(.decimalPad)
                    TextField("现价", text: $currentPrice)
                        .keyboardType(.decimalPad)
                }

                Section("数量") {
                    TextField("持有数量", text: $quantity)
                        .keyboardType(.decimalPad)
                }

                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.callout)
                    }
                }
            }
            .navigationTitle(isEdit ? "编辑资产" : "新增资产")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEdit ? "保存" : "新增") {
                        submit()
                    }
                    .disabled(isSubmitting)
                }
            }
            .onAppear {
                if let asset {
                    symbol = asset.symbol
                    category = asset.category
                    costBasis = String(asset.costBasis)
                    currentPrice = String(asset.currentPrice)
                    quantity = String(asset.quantity)
                }
            }
        }
    }

    private func submit() {
        error = nil
        guard !symbol.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "请输入资产代码/名称"
            return
        }
        guard let cb = Double(costBasis), cb > 0 else {
            error = "成本价必须大于 0"
            return
        }
        guard let cp = Double(currentPrice), cp > 0 else {
            error = "现价必须大于 0"
            return
        }
        guard let qty = Double(quantity), qty > 0 else {
            error = "数量必须大于 0"
            return
        }

        let draft = AssetDraft(
            symbol: symbol.trimmingCharacters(in: .whitespaces),
            category: category,
            costBasis: cb,
            currentPrice: cp,
            quantity: qty,
            currency: "CNY"
        )

        isSubmitting = true
        Task {
            let success = await onSubmit(draft)
            isSubmitting = false
            if success {
                dismiss()
            } else {
                error = "操作失败，请重试"
            }
        }
    }
}
