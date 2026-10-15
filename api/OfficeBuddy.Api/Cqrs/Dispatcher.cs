using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Cqrs;

// Resolves the IRequestHandler<,> for the request's runtime type and invokes it. Registered
// AddScoped – never Singleton, or it would capture the root IServiceProvider and fail to
// resolve scoped handlers that need OfficeBuddyDbContext.
public class Dispatcher(IServiceProvider services) : IDispatcher
{
    public async Task<TResult> SendAsync<TResult>(IRequest<TResult> request, CancellationToken ct = default)
    {
        var handlerType = typeof(IRequestHandler<,>).MakeGenericType(request.GetType(), typeof(TResult));

        // dynamic avoids hand-written MethodInfo.Invoke boilerplate for a handful of request
        // types; the compiler-generated call site uses the DLR binder, not reflection Invoke, so
        // exceptions from inside HandleAsync are not wrapped. Nullable-reference analysis does
        // not see through the two lines below – that is an accepted, contained blind spot here.
        dynamic handler = services.GetRequiredService(handlerType);
        return await handler.HandleAsync((dynamic)request, ct);
    }
}
