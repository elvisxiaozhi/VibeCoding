import SwiftUI

@main
struct AssetDashboardApp: App {
    @State private var authVM = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authVM)
                .preferredColorScheme(.dark)
        }
    }
}
