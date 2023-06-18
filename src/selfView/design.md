# Current setup

content.js
    `await new selfViewElementModifier(origStream);`

1. selfViewElementModifier initializes a StorageHandler 
   2. if `enabled` then obscure 
   3. checks for changes in settings 
4. obscure 
   5. looks at all videoElements to find the `origStream`
   6. if found, then
      7. Add the obscure filter
      8. Draw the cross hair
   6. polls if no selfViewElement found

```
{"selfView":{
   "active":false,
   "enabled":true
   }
}
```

# new needs
What I need:
   1. Add framing crosshair
   2. replace videoElement with a supplied stream for bcs (or overlay)

```
"selfView":{
   obscure: {
      "active":false,
      "enabled":true
   },
    framing: {
        "active":false,
        "enabled":true
    },
    overlay: {
        "active":false,
        "enabled":true
    }
}
```

selfViewElementModifier
1. find the selfViewElement
2. obscure
3. framing
4. replace (stub)
5. unobscure
6. unframe
7. unreplace
2. Storage check
   3. selfView
