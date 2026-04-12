import SwiftUI

struct AssetListView: View {
    @Environment(AuthViewModel.self) private var authVM
    @State private var vm = AssetListViewModel()
    @State private var showAddForm = false
    @State private var editingAsset: Asset?
    @State private var deletingAsset: Asset?

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if vm.assets.isEmpty {
                    emptyState
                } else {
                    assetList
                }
            }
            .navigationTitle("资产")
            .toolbar {
                if authVM.isLoggedIn {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            showAddForm = true
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
                ToolbarItem(placement: .secondaryAction) {
                    sortMenu
                }
            }
            .refreshable {
                await vm.load(isLoggedIn: authVM.isLoggedIn)
            }
            .task {
                await vm.load(isLoggedIn: authVM.isLoggedIn)
            }
            .onChange(of: authVM.isLoggedIn) {
                Task { await vm.load(isLoggedIn: authVM.isLoggedIn) }
            }
            .sheet(isPresented: $showAddForm) {
                AssetFormView(asset: nil) { draft in
                    await vm.addAsset(draft)
                }
            }
            .sheet(item: $editingAsset) { asset in
                AssetFormView(asset: asset) { draft in
                    await vm.updateAsset(id: asset.id, draft)
                }
            }
            .confirmationDialog(
                "确认删除",
                isPresented: .init(
                    get: { deletingAsset != nil },
                    set: { if !$0 { deletingAsset = nil } }
                ),
                presenting: deletingAsset
            ) { asset in
                Button("删除「\(asset.symbol)」", role: .destructive) {
                    Task { await vm.deleteAsset(id: asset.id) }
                }
            } message: { asset in
                Text("确定要删除资产「\(asset.symbol)」吗？此操作无法撤销。")
            }
        }
    }

    // MARK: - Subviews

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "wallet.bifold")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("暂无资产数据")
                .font(.subheadline)
            if authVM.isLoggedIn {
                Text("点击右上角 + 添加您的第一笔资产")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("登录后可管理您的资产")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var assetList: some View {
        List {
            if !authVM.isLoggedIn {
                Section {
                    HStack(spacing: 8) {
                        Image(systemName: "eye")
                        Text("当前为演示模式，登录后管理您的资产")
                            .font(.callout)
                    }
                    .foregroundStyle(.blue)
                    .listRowBackground(Color.blue.opacity(0.1))
                }
            }

            Section {
                ForEach(vm.sorted) { asset in
                    AssetRowView(asset: asset)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            if authVM.isLoggedIn {
                                editingAsset = asset
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            if authVM.isLoggedIn {
                                Button(role: .destructive) {
                                    deletingAsset = asset
                                } label: {
                                    Label("删除", systemImage: "trash")
                                }
                                Button {
                                    editingAsset = asset
                                } label: {
                                    Label("编辑", systemImage: "pencil")
                                }
                                .tint(.blue)
                            }
                        }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var sortMenu: some View {
        Menu {
            ForEach(SortKey.allCases, id: \.self) { key in
                Button {
                    vm.toggleSort(key)
                } label: {
                    HStack {
                        Text(key.label)
                        if vm.sortKey == key {
                            Image(systemName: vm.sortAscending ? "arrow.up" : "arrow.down")
                        }
                    }
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
        }
    }
}
