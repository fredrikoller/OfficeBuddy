namespace OfficeBuddy.Api;

public static class Policies
{
    // Authorization policy for admin endpoints: requires the Entra app role below.
    public const string Admin = "Admin";

    // Value of the app role in tab/aad.manifest.json (the `roles` claim).
    public const string AdminRole = "Admin";
}
