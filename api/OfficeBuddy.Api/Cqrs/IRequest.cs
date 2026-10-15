namespace OfficeBuddy.Api.Cqrs;

// Not meant to be implemented directly by a message – use ICommand<TResult> or IQuery<TResult>.
// Both are the same thing to the dispatcher; the split exists purely so a message's own type
// name documents whether handling it is a read or a write.
public interface IRequest<TResult>
{
}

public interface ICommand<TResult> : IRequest<TResult>
{
}

public interface IQuery<TResult> : IRequest<TResult>
{
}
