namespace OfficeBuddy.Api.Data.Entities;

public class ChannelOffice
{
    public const int ChannelIdMaxLength = 200;

    public required string ChannelId { get; set; }
    public int OfficeId { get; set; }
    public Office Office { get; set; } = null!;
}
