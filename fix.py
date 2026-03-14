content = open('app/api/escrow/release/route.ts').read()
fixed = content.replace('!escrowCode  !buyerKey  !buyerUsername', '!escrowCode  !buyerKey  !buyerUsername')
open('app/api/escrow/release/route.ts', 'w').write(fixed)
print('done:', 'changed' if content != fixed else 'NOT FOUND')
