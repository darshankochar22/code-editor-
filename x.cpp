#include <iostream>
using namespace std;

int main(){
    int t;
    cin>>t;

    while(t--){
        int n;
        cin>>n;
        int a[n];
        vector<int>b(n);
        int x=INT_MAX;

        for(int i=0;i<n;i++){
            cin>>a[i];
        }
        for(int k=0;k<n;k++){
            int z=0;
            for(int i=0; i<n-1; i++){
                if(i != k) b.push_back(a[i]);
            }
            for(int i=0;i<n-1;i++){
                z+= abs(b[i+1]-b[i]);
            }
            x=min(x,z);
        }
       cout<<x<<endl;
    }
    return 0;
}