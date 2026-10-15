namespace OfficeBuddy.Api.Data.Entities;

public class Office
{
    public const int NameMaxLength = 100;

    public int Id { get; set; }
    public required string Name { get; set; }
}
